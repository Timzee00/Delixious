import { supabaseAdmin } from '../config/supabase.js';
import { initiateTransfer } from '../utils/paystack.js';

const AGENT_TRANSITIONS = {
  assigned: ['picked_up'],
  picked_up: ['en_route'],
  en_route: ['delivered'],
  delivered: [],
};

const CLAIMABLE_ORDER_STATUSES = ['confirmed', 'preparing', 'out_for_delivery'];

async function loadOrderWithRestaurant(orderId) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, restaurants(owner_id)')
    .eq('id', orderId)
    .single();
  if (error || !data) return null;
  return data;
}

async function payoutRider(order) {
  if (order.rider_payout_status === 'paid' || !order.rider_payout_amount) return;

  const { data: locked } = await supabaseAdmin
    .from('orders')
    .update({ rider_payout_status: 'processing' })
    .eq('id', order.id)
    .eq('rider_payout_status', 'pending')
    .select('id')
    .maybeSingle();

  if (!locked) return;

  const { data: tracking } = await supabaseAdmin
    .from('delivery_tracking')
    .select('delivery_agent_id')
    .eq('order_id', order.id)
    .single();

  if (!tracking?.delivery_agent_id) {
    await supabaseAdmin.from('orders').update({ rider_payout_status: 'failed' }).eq('id', order.id).eq('rider_payout_status', 'processing');
    return;
  }

  const { data: rider } = await supabaseAdmin
    .from('profiles')
    .select('rider_transfer_recipient_code')
    .eq('id', tracking.delivery_agent_id)
    .single();

  if (!rider?.rider_transfer_recipient_code) {
    await supabaseAdmin.from('orders').update({ rider_payout_status: 'failed' }).eq('id', order.id).eq('rider_payout_status', 'processing');
    return;
  }

  const reference = `rider_payout_${order.id}`;
  // Store the reference BEFORE contacting Paystack so an early webhook can
  // find the payout. Keep the status processing until transfer.success.
  const { error: referenceError } = await supabaseAdmin.from('orders')
    .update({ rider_payout_reference: reference })
    .eq('id', order.id)
    .eq('rider_payout_status', 'processing');
  if (referenceError) {
    // Delivery status is already persisted. Keep this as a recoverable
    // payout incident instead of telling the rider delivery failed.
    console.error('Unable to link rider transfer reference', { orderId: order.id, message: referenceError.message });
    return;
  }

  try {
    const transfer = await initiateTransfer({
      amountKobo: Math.round(order.rider_payout_amount * 100),
      recipientCode: rider.rider_transfer_recipient_code,
      reason: `Delivery payout for order #${order.id.slice(0, 8)}`,
      reference,
    });

    if (!transfer.status) {
      // Explicit provider refusal is final for this attempt.
      await supabaseAdmin.from('orders')
        .update({ rider_payout_status: 'failed' })
        .eq('id', order.id)
        .eq('rider_payout_status', 'processing');
    }
    // A 200 response usually means queued, not settled. A signed
    // transfer.success webhook confirms the paid status.
  } catch (err) {
    // A timeout can happen AFTER Paystack accepted the transfer. Keep the
    // stable reference and processing state for manual reconciliation.
    console.error('Rider payout requires reconciliation', { orderId: order.id, message: err.message });
  }
}

export async function searchDeliveryAgents(req, res, next) {
  try {
    const { phone } = req.query;
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'delivery_agent')
      .eq('rider_approval_status', 'approved')
      .ilike('phone', `%${phone.trim()}%`)
      .limit(10);
    if (error) throw error;
    res.json({ agents: data });
  } catch (err) {
    next(err);
  }
}

export async function assignAgent(req, res, next) {
  try {
    const { delivery_agent_id } = req.body;
    const order = await loadOrderWithRestaurant(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const isRestaurantOwner = order.restaurants.owner_id === req.user.id;
    if (!isRestaurantOwner && req.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Only the restaurant owner can assign a delivery agent.' });
    }
    if (!order.payment_status || order.payment_status !== 'paid') {
      return res.status(400).json({ error: 'A delivery agent can only be assigned after payment is confirmed.' });
    }
    if (!['confirmed', 'preparing'].includes(order.status)) {
      return res.status(400).json({ error: `Cannot assign an agent while order is "${order.status}".` });
    }

    const { data: agentProfile, error: agentError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, full_name, rider_approval_status')
      .eq('id', delivery_agent_id)
      .single();
    if (agentError || !agentProfile || agentProfile.role !== 'delivery_agent') {
      return res.status(400).json({ error: 'delivery_agent_id must belong to a valid delivery agent.' });
    }
    if (agentProfile.rider_approval_status !== 'approved') {
      return res.status(400).json({ error: 'This rider is not yet approved to take deliveries.' });
    }

    const { data, error } = await supabaseAdmin
      .from('delivery_tracking')
      .update({ delivery_agent_id, status: 'assigned', claimed_at: new Date().toISOString() })
      .eq('order_id', order.id)
      .eq('status', 'pending')
      .is('delivery_agent_id', null)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ error: 'This delivery already has a rider. Refresh before assigning again.' });

    await supabaseAdmin.from('notifications').insert({
      user_id: order.user_id,
      title: 'Delivery agent assigned',
      body: `${agentProfile.full_name} will be delivering your order.`,
      type: 'order_update',
    });
    res.json({ message: 'Delivery agent assigned.', delivery_tracking: data });
  } catch (err) {
    next(err);
  }
}

export async function listAvailableDeliveries(req, res, next) {
  try {
    if (req.profile.role !== 'admin' && req.profile.rider_approval_status !== 'approved') {
      return res.status(403).json({ error: 'Only approved riders can browse available deliveries.' });
    }
    const { page = 1, limit = 20 } = req.query;
    const from = (page - 1) * limit;

    // Filter in PostgreSQL *before* pagination; fetching and filtering every
    // pending delivery in JavaScript grows without bounds at marketplace scale.
    const { data, error, count } = await supabaseAdmin
      .from('delivery_tracking')
      .select('order_id, status, updated_at, orders!inner(id, delivery_address, total_amount, rider_payout_amount, status, payment_status, restaurants(name, address))', { count: 'exact' })
      .eq('status', 'pending')
      .is('delivery_agent_id', null)
      .eq('orders.payment_status', 'paid')
      .in('orders.status', CLAIMABLE_ORDER_STATUSES)
      .order('updated_at', { ascending: true })
      .order('order_id', { ascending: true })
      .range(from, from + limit - 1);
    if (error) throw error;
    res.json({ deliveries: data || [], total: count || 0, page, limit });
  } catch (err) {
    next(err);
  }
}

export async function claimDelivery(req, res, next) {
  try {
    if (req.profile.rider_approval_status !== 'approved') {
      return res.status(403).json({ error: 'Your rider account is not yet approved to take deliveries.' });
    }

    const order = await loadOrderWithRestaurant(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.payment_status !== 'paid' || !CLAIMABLE_ORDER_STATUSES.includes(order.status)) {
      return res.status(400).json({ error: 'This order is not eligible for delivery pickup yet.' });
    }

    const { data, error } = await supabaseAdmin
      .from('delivery_tracking')
      .update({ delivery_agent_id: req.user.id, status: 'assigned', claimed_at: new Date().toISOString() })
      .eq('order_id', req.params.orderId)
      .eq('status', 'pending')
      .is('delivery_agent_id', null)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ error: 'This delivery has already been claimed by someone else.' });

    await supabaseAdmin.from('notifications').insert({
      user_id: order.user_id,
      title: 'Delivery agent assigned',
      body: `${req.profile.full_name} will be delivering your order.`,
      type: 'order_update',
    });
    res.json({ message: 'Delivery claimed.', delivery_tracking: data });
  } catch (err) {
    next(err);
  }
}

export async function updateLocation(req, res, next) {
  try {
    const { lat, lng } = req.body;
    const { data: tracking, error } = await supabaseAdmin.from('delivery_tracking').select('*').eq('order_id', req.params.orderId).single();
    if (error || !tracking) return res.status(404).json({ error: 'No delivery assigned to this order yet.' });
    if (tracking.delivery_agent_id !== req.user.id && req.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Only the assigned delivery agent can update location.' });
    }
    const { data: updated, error: updateError } = await supabaseAdmin.from('delivery_tracking').update({ current_lat: lat, current_lng: lng }).eq('order_id', req.params.orderId).select().single();
    if (updateError) throw updateError;
    res.json({ message: 'Location updated.', delivery_tracking: updated });
  } catch (err) {
    next(err);
  }
}

export async function updateDeliveryStatus(req, res, next) {
  try {
    const { status } = req.body;
    const { data: tracking, error } = await supabaseAdmin.from('delivery_tracking').select('*').eq('order_id', req.params.orderId).single();
    if (error || !tracking) return res.status(404).json({ error: 'No delivery assigned to this order yet.' });
    if (tracking.delivery_agent_id !== req.user.id && req.profile.role !== 'admin') {
      return res.status(403).json({ error: 'Only the assigned delivery agent can update delivery status.' });
    }
    const allowedNext = AGENT_TRANSITIONS[tracking.status] || [];
    if (!allowedNext.includes(status)) return res.status(400).json({ error: `Cannot move delivery from "${tracking.status}" to "${status}".` });

    const currentOrder = await loadOrderWithRestaurant(req.params.orderId);
    if (!currentOrder || currentOrder.payment_status !== 'paid') {
      return res.status(409).json({ error: 'A delivery can only progress for a paid order.' });
    }
    const requiredOrderStatuses = { picked_up: ['preparing'], en_route: ['out_for_delivery'], delivered: ['out_for_delivery'] };
    if (!requiredOrderStatuses[status]?.includes(currentOrder.status)) {
      return res.status(409).json({ error: 'The restaurant order is not ready for this delivery step. Refresh and try again.' });
    }

    const { data: updated, error: updateError } = await supabaseAdmin.from('delivery_tracking')
      .update({ status })
      .eq('order_id', req.params.orderId)
      .eq('status', tracking.status)
      .select()
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return res.status(409).json({ error: 'Delivery state has changed. Refresh and retry.' });

    const orderStatusMap = { picked_up: 'out_for_delivery', en_route: 'out_for_delivery', delivered: 'delivered' };
    if (orderStatusMap[status]) {
      const { data: order, error: orderUpdateError } = await supabaseAdmin.from('orders')
        .update({ status: orderStatusMap[status] })
        .eq('id', req.params.orderId)
        .eq('payment_status', 'paid')
        .in('status', requiredOrderStatuses[status])
        .select()
        .maybeSingle();
      if (orderUpdateError || !order) {
        // Best-effort compensation until an atomic database RPC is deployed.
        await supabaseAdmin.from('delivery_tracking').update({ status: tracking.status })
          .eq('order_id', req.params.orderId).eq('status', status);
        if (orderUpdateError) throw orderUpdateError;
        return res.status(409).json({ error: 'Order changed during dispatch. Please refresh and retry.' });
      }
      if (order) {
        await supabaseAdmin.from('notifications').insert({
          user_id: order.user_id,
          title: 'Delivery update',
          body: status === 'delivered' ? 'Your order has been delivered. Enjoy your meal!' : `Your order is ${status.replace(/_/g, ' ')}.`,
          type: 'order_update',
        });
        if (status === 'delivered') await payoutRider(order);
      }
    }
    res.json({ message: 'Delivery status updated.', delivery_tracking: updated });
  } catch (err) {
    next(err);
  }
}

export async function getDeliveryTracking(req, res, next) {
  try {
    const order = await loadOrderWithRestaurant(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    const { data: tracking, error } = await supabaseAdmin.from('delivery_tracking').select('*').eq('order_id', req.params.orderId).maybeSingle();
    if (error) throw error;
    if (!tracking) return res.json({ delivery_tracking: null });

    const isCustomer = order.user_id === req.user.id;
    const isRestaurantOwner = order.restaurants.owner_id === req.user.id;
    const isAssignedAgent = tracking.delivery_agent_id === req.user.id;
    const isAdmin = req.profile.role === 'admin';
    if (!isCustomer && !isRestaurantOwner && !isAssignedAgent && !isAdmin) return res.status(403).json({ error: 'You do not have access to this delivery.' });

    let agent = null;
    if (tracking.delivery_agent_id) {
      const { data: agentProfile } = await supabaseAdmin.from('profiles').select('id, full_name, phone').eq('id', tracking.delivery_agent_id).maybeSingle();
      agent = agentProfile || null;
    }
    res.json({ delivery_tracking: { ...tracking, agent } });
  } catch (err) {
    next(err);
  }
}

export async function listMyDeliveries(req, res, next) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const from = (page - 1) * limit;
    const { data, error, count } = await supabaseAdmin
      .from('delivery_tracking')
      .select('*, orders(id, delivery_address, total_amount, status, rider_payout_amount, rider_payout_status, payment_status, restaurants(name, address))', { count: 'exact' })
      .eq('delivery_agent_id', req.user.id)
      .neq('status', 'delivered')
      .order('updated_at', { ascending: false })
      .order('order_id', { ascending: true })
      .range(from, from + limit - 1);
    if (error) throw error;
    res.json({ deliveries: data || [], total: count || 0, page, limit });
  } catch (err) {
    next(err);
  }
}

export async function listMyDeliveryHistory(req, res, next) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const from = (page - 1) * limit;
    const { data, error, count } = await supabaseAdmin
      .from('delivery_tracking')
      .select('*, orders(id, delivery_address, total_amount, rider_payout_amount, rider_payout_status, payment_status, restaurants(name))', { count: 'exact' })
      .eq('delivery_agent_id', req.user.id)
      .eq('status', 'delivered')
      .order('updated_at', { ascending: false })
      .range(from, from + limit - 1);
    if (error) throw error;
    res.json({ deliveries: data || [], total: count || 0, page, limit });
  } catch (err) {
    next(err);
  }
}
