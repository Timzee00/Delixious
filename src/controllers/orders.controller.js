import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase.js';
import { initializeTransaction } from '../utils/paystack.js';
import { calculateOrderAllocation } from '../utils/walletPricing.js';
import { normalizeNigerianState } from '../utils/nigeriaStates.js';
import { assertRestaurantDeliveryArea } from '../utils/deliveryAreas.js';
import { normalizeSelectedExtras, extrasTotalKobo } from '../utils/menuExtras.js';

const VALID_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  // Delivery dispatch and completion are controlled by the assigned rider.
  preparing: [],
  out_for_delivery: [],
  delivered: [],
  cancelled: [],
};

async function buildCheckoutQuote(userId, input) {
  const state=normalizeNigerianState(input.delivery_state);
  const lat=Number(input.delivery_lat),lng=Number(input.delivery_lng);
  if(!input.delivery_address?.trim()||!state||input.delivery_lat==null||input.delivery_lng==null||
     !Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat > 90||lng < -180||lng > 180) {
    throw new Error('Enter a delivery address, select your state and pin your delivery location before checkout.');
  }
  const {data:carts,error:cartsError}=await supabaseAdmin.from('carts').select('id,restaurant_id').eq('user_id',userId);
  if(cartsError)throw cartsError;
  if(!carts?.length)throw new Error('Your cart is empty.');
  const {data:settings,error:settingsError}=await supabaseAdmin.from('wallet_settings')
    .select('restaurant_commission_bps,allow_interstate_delivery').eq('id',1).single();
  if(settingsError)throw settingsError;
  const {data:zone,error:zoneError}=await supabaseAdmin.from('delivery_zones').select('*').eq('state',state).maybeSingle();
  if(zoneError)throw zoneError;
  if(!zone?.is_active||zone.base_fee_kobo==null||zone.per_km_fee_kobo==null||zone.max_distance_km==null) {
    throw new Error('Delivery is not configured for this state yet. Please choose another address or contact support.');
  }
  const prepared=[];
  let foodTotalKobo=0,deliveryTotalKobo=0,grandTotalKobo=0;
  for(const cart of carts) {
    const {data:cartItems,error:itemsError}=await supabaseAdmin.from('cart_items')
      .select('quantity,special_instructions,selected_extras,menu_items(id,name,price,is_available,restaurant_id,extras)')
      .eq('cart_id',cart.id);
    if(itemsError)throw itemsError;
    if(!cartItems?.length)continue;
    const unavailable=cartItems.find(ci=>!ci.menu_items||!ci.menu_items.is_available||ci.menu_items.restaurant_id!==cart.restaurant_id);
    if(unavailable)throw new Error(`${unavailable.menu_items?.name||'A cart item'} is no longer available. Refresh your cart.`);
    const {data:restaurant,error:restaurantError}=await supabaseAdmin.from('restaurants')
      .select('id,name,is_open,approval_status,paystack_subaccount_code,state,lat,lng,service_radius_km,service_area_verified')
      .eq('id',cart.restaurant_id).single();
    if(restaurantError||!restaurant)throw new Error('Restaurant not found.');
    if(!restaurant.is_open)throw new Error(`${restaurant.name} is currently closed.`);
    if(restaurant.approval_status!=='approved'||!restaurant.service_area_verified)throw new Error(`${restaurant.name} is not approved and verified for delivery yet.`);
    if(!restaurant.paystack_subaccount_code)throw new Error(`${restaurant.name} has not completed payout setup and cannot accept paid orders yet.`);
    const area=assertRestaurantDeliveryArea({restaurant,destinationState:state,deliveryLat:lat,deliveryLng:lng,zone,allowInterstate:settings.allow_interstate_delivery===true});
    const itemRows=[];
    let restaurantFoodKobo=0;
    for(const ci of cartItems) {
      const quantity=Number(ci.quantity),unitKobo=Math.round(Number(ci.menu_items.price)*100);
      if(!Number.isSafeInteger(quantity)||quantity<1||quantity>100||!Number.isSafeInteger(unitKobo)||unitKobo<0)throw new Error('A cart item has an invalid price or quantity. Refresh your cart.');
      const extras=normalizeSelectedExtras(ci.menu_items.extras,ci.selected_extras||[]);
      const lineKobo=unitKobo*quantity+extrasTotalKobo(extras)*quantity;
      if(!Number.isSafeInteger(lineKobo))throw new Error('The cart total is too large.');
      restaurantFoodKobo+=lineKobo;
      itemRows.push({
        menu_item_id:ci.menu_items.id,name_snapshot:ci.menu_items.name,price_snapshot:Number(ci.menu_items.price),
        quantity,subtotal:lineKobo/100,
        extras_snapshot:extras.map(extra=>({extra_id:extra.extra_id,name:extra.name,unit_price_kobo:extra.unit_price_kobo,quantity:extra.quantity,line_total_kobo:extra.line_total_kobo*quantity})),
      });
    }
    if(!Number.isSafeInteger(restaurantFoodKobo)||restaurantFoodKobo<=0)throw new Error('Invalid cart total. Refresh your cart.');
    const allocation=calculateOrderAllocation(restaurantFoodKobo,area.deliveryFeeKobo,settings);
    prepared.push({cart,restaurant,itemRows,foodKobo:restaurantFoodKobo,deliveryKobo:area.deliveryFeeKobo,distanceKm:area.distanceKm,allocation});
    foodTotalKobo+=restaurantFoodKobo;deliveryTotalKobo+=area.deliveryFeeKobo;grandTotalKobo+=allocation.customerTotalKobo;
  }
  if(!prepared.length)throw new Error('Your cart is empty.');
  return {prepared,settings,state,grandTotalKobo,quote:{
    subtotal:foodTotalKobo/100,delivery_fee:deliveryTotalKobo/100,total_amount:grandTotalKobo/100,delivery_state:state,
    deliveries:prepared.map(row=>({restaurant_id:row.restaurant.id,restaurant_name:row.restaurant.name,distance_km:Number(row.distanceKm.toFixed(2)),delivery_fee:row.deliveryKobo/100})),
  }};
}

export async function quoteCheckout(req,res,next) {
  try {
    const result=await buildCheckoutQuote(req.user.id,req.body);
    res.set('Cache-Control','private, no-store');
    res.json(result.quote);
  } catch(err) {
    if(err.message&&/cart|delivery|restaurant|state|price|payout|available|address|location|extra|checkout/i.test(err.message))return res.status(400).json({error:err.message});
    next(err);
  }
}

export async function checkout(req,res,next) {
  try {
    const result=await buildCheckoutQuote(req.user.id,req.body);
    const checkoutGroupId=uuidv4(),createdOrders=[],splitSubaccounts=[];
    for(const row of result.prepared) {
      const {restaurant,itemRows,foodKobo,deliveryKobo,distanceKm,allocation}=row;
      const {data:order,error:orderError}=await supabaseAdmin.from('orders').insert({
        user_id:req.user.id,restaurant_id:restaurant.id,status:'pending',
        subtotal:foodKobo/100,delivery_fee:deliveryKobo/100,total_amount:allocation.customerTotalKobo/100,
        platform_commission:allocation.platformGrossCommissionKobo/100,rider_payout_amount:allocation.riderPayoutKobo/100,
        restaurant_delivery_cost_kobo:0,restaurant_commission_bps:result.settings.restaurant_commission_bps,
        rider_commission_bps:0,rider_commission_kobo:0,restaurant_net_amount:allocation.restaurantShareKobo/100,
        customer_delivery_fee_kobo:deliveryKobo,delivery_distance_km:Number(distanceKm.toFixed(3)),
        delivery_zone_state:result.state,destination_state:result.state,
        delivery_address:req.body.delivery_address.trim(),delivery_lat:Number(req.body.delivery_lat),delivery_lng:Number(req.body.delivery_lng),
        payment_status:'pending',checkout_group_id:checkoutGroupId,restaurant_paystack_subaccount_code:restaurant.paystack_subaccount_code,
      }).select().single();
      if(orderError)throw orderError;
      const {error:itemError}=await supabaseAdmin.from('order_items').insert(itemRows.map(item=>({...item,order_id:order.id})));
      if(itemError)throw itemError;
      const {error:trackingError}=await supabaseAdmin.from('delivery_tracking').insert({order_id:order.id,status:'pending'});
      if(trackingError)throw trackingError;
      createdOrders.push(order);
      splitSubaccounts.push({subaccount:restaurant.paystack_subaccount_code,shareKobo:allocation.restaurantShareKobo});
    }
    const reference=`delixious_${uuidv4()}`;
    const {error:paymentError}=await supabaseAdmin.from('payments').insert({checkout_group_id:checkoutGroupId,provider:'paystack',reference,amount:result.grandTotalKobo/100,status:'pending'});
    if(paymentError)throw paymentError;
    let paystackResponse;
    try {
      paystackResponse=await initializeTransaction({
        email:req.user.email,amountKobo:result.grandTotalKobo,reference,
        callback_url:`${process.env.FRONTEND_URL}/order-confirmation?checkout_group_id=${encodeURIComponent(checkoutGroupId)}&reference=${encodeURIComponent(reference)}`,
        metadata:{checkout_group_id:checkoutGroupId,user_id:req.user.id},splitSubaccounts,
      });
    } catch(paymentError) {
      await supabaseAdmin.from('payments').update({status:'failed'}).eq('reference',reference);
      await supabaseAdmin.from('orders').delete().eq('checkout_group_id',checkoutGroupId).eq('payment_status','pending');
      throw paymentError;
    }
    if(!paystackResponse.status) {
      await supabaseAdmin.from('payments').update({status:'failed'}).eq('reference',reference);
      await supabaseAdmin.from('orders').delete().eq('checkout_group_id',checkoutGroupId).eq('payment_status','pending');
      return res.status(502).json({error:'Could not initialize payment. Please try again.'});
    }
    const {error:referenceError}=await supabaseAdmin.from('orders').update({payment_reference:reference}).eq('checkout_group_id',checkoutGroupId);
    if(referenceError) {
      await supabaseAdmin.from('payments').update({status:'failed'}).eq('reference',reference);
      await supabaseAdmin.from('orders').delete().eq('checkout_group_id',checkoutGroupId).eq('payment_status','pending');
      throw referenceError;
    }
    res.status(201).json({message:'Orders created. Redirect the customer to Paystack to complete payment.',orders:createdOrders,checkout_group_id:checkoutGroupId,quote:result.quote,payment:{
      reference,authorization_url:paystackResponse.data.authorization_url,access_code:paystackResponse.data.access_code,
    }});
  } catch(err) {
    if(err.message&&/cart|delivery|restaurant|state|price|payout|available|address|location|extra|checkout/i.test(err.message))return res.status(400).json({error:err.message});
    next(err);
  }
}

export async function listMyOrders(req, res, next) {
  try {
    const { page, limit, statuses } = req.query;
    const from = (page - 1) * limit;
    let query = supabaseAdmin
      .from('orders')
      .select('*, restaurants(name, logo_url), order_items(*), reviews(id, rating, comment, created_at)', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + limit - 1);
    if (statuses) query = query.in('status', statuses.split(','));
    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ orders: data, total: count, page, limit });
  } catch (err) {
    next(err);
  }
}

export async function getOrderGroup(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*, restaurants(id, name, logo_url, owner_id), order_items(*), delivery_tracking(*), reviews(id, rating, comment, created_at)')
      .eq('checkout_group_id', req.params.checkoutGroupId)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!data?.length) return res.status(404).json({ error: 'Checkout group not found.' });

    res.json({ orders: data, checkout_group_id: req.params.checkoutGroupId });
  } catch (err) {
    next(err);
  }
}

export async function getOrder(req, res, next) {
  try {
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*, restaurants(id, name, logo_url, owner_id), order_items(*), delivery_tracking(*), reviews(id, rating, comment, created_at)')
      .eq('id', req.params.id)
      .single();
    if (error || !order) return res.status(404).json({ error: 'Order not found.' });
    const isCustomer = order.user_id === req.user.id;
    const isRestaurantOwner = order.restaurants?.owner_id === req.user.id;
    const isAdmin = req.profile.role === 'admin';
    if (!isCustomer && !isRestaurantOwner && !isAdmin) return res.status(403).json({ error: 'You do not have access to this order.' });
    res.json({ order });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req, res, next) {
  try {
    const { status } = req.body;
    const { data: order, error } = await supabaseAdmin.from('orders').select('*, restaurants(owner_id)').eq('id', req.params.id).single();
    if (error || !order) return res.status(404).json({ error: 'Order not found.' });
    const isRestaurantOwner = order.restaurants.owner_id === req.user.id;
    if (!isRestaurantOwner && req.profile.role !== 'admin') return res.status(403).json({ error: 'Only the restaurant owner can update order status.' });
    if (['confirmed', 'preparing', 'out_for_delivery', 'delivered'].includes(status) && order.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment must be confirmed before this order can progress.' });
    }
    const allowedNext = VALID_TRANSITIONS[order.status] || [];
    if (!allowedNext.includes(status)) return res.status(400).json({ error: `Cannot move order from "${order.status}" to "${status}".` });
    if (status === 'cancelled' && (order.payment_status === 'paid' || order.payment_status === 'refunded' || order.payment_reference)) {
      return res.status(409).json({ error: 'A charged or in-progress payment requires support-assisted cancellation and refund handling.' });
    }

    let update = supabaseAdmin.from('orders')
      .update({ status })
      .eq('id', order.id)
      .eq('status', order.status)
      .eq('payment_status', order.payment_status);
    if (status === 'cancelled') update = update.is('payment_reference', null);
    const { data: updated, error: updateError } = await update.select().maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return res.status(409).json({ error: 'Order changed during this request. Refresh and try again.' });
    await supabaseAdmin.from('notifications').insert({ user_id: order.user_id, title: 'Order update', body: `Your order is now "${status.replace(/_/g, ' ')}".`, type: 'order_update' });
    res.json({ message: 'Order status updated.', order: updated });
  } catch (err) {
    next(err);
  }
}

export async function cancelOrder(req, res, next) {
  try {
    const { data: order, error } = await supabaseAdmin.from('orders').select('*').eq('id', req.params.id).single();
    if (error || !order) return res.status(404).json({ error: 'Order not found.' });
    if (order.user_id !== req.user.id) return res.status(403).json({ error: 'You can only cancel your own orders.' });
    if (!['pending', 'confirmed'].includes(order.status)) return res.status(400).json({ error: `Order can no longer be cancelled (status: ${order.status}).` });
    // A paid order requires a confirmed refund workflow; simply toggling
    // status to "cancelled" would leave the customer charged.
    if (order.payment_status === 'paid' || order.payment_status === 'refunded') {
      return res.status(409).json({ error: 'This order has a completed payment. Please contact support to request cancellation and a refund.' });
    }
    if (order.payment_status === 'pending' && order.payment_reference) {
      return res.status(409).json({ error: 'Payment authorization is in progress. Contact support before cancelling; your payment may still complete.' });
    }
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', order.id)
      .eq('status', order.status)
      .in('payment_status', ['pending', 'failed'])
      // Do not race a newly-created Paystack checkout reference.
      .is('payment_reference', null)
      .select()
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return res.status(409).json({ error: 'Order or payment status changed. Refresh the order before cancelling.' });
    res.json({ message: 'Unpaid order cancelled.', order: updated });
  } catch (err) {
    next(err);
  }
}

export async function listRestaurantOrders(req, res, next) {
  try {
    const { page, limit, statuses, paid_only } = req.query;
    const from = (page - 1) * limit;
    let query = supabaseAdmin
      .from('orders')
      .select('*, order_items(*)', { count: 'exact' })
      .eq('restaurant_id', req.restaurant.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + limit - 1);
    if (statuses) query = query.in('status', statuses.split(','));
    if (paid_only === 'true') query = query.eq('payment_status', 'paid');
    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ orders: data, total: count, page, limit });
  } catch (err) {
    next(err);
  }
}
