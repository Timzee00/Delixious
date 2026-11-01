import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyTransaction, listBanks } from '../utils/paystack.js';
import { assertVerifiedPaystackPayment } from '../utils/paymentValidation.js';
import { assertMatchingRiderTransfer } from '../utils/transferValidation.js';
import { removePurchasedCartLines } from '../utils/paidCartCleanup.js';

async function handleSuccessfulPayment(data) {
  const reference = data.reference;

  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();

  if (!payment) return;

  // A valid webhook signature proves the source, not the price. Validate
  // reference, exact NGN amount in kobo and currency before fulfillment.
  assertVerifiedPaystackPayment(data, payment);
  if (payment.status === 'success') return;

  // Atomically claim the payment so duplicate webhooks/verification calls do
  // not issue duplicate notifications or race the order state transition.
  const { data: claimedPayment, error: claimError } = await supabaseAdmin
    .from('payments')
    .update({ status: 'processing', raw_response: data })
    .eq('id', payment.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  if (claimError) throw claimError;
  if (!claimedPayment) return;

  let newlyPaidOrders = [];
  try {
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .update({ payment_status: 'paid', status: 'confirmed' })
      .eq('checkout_group_id', claimedPayment.checkout_group_id)
      .eq('payment_status', 'pending')
      .select();
    if (ordersError) throw ordersError;
    newlyPaidOrders = orders || [];

    // If a previous callback marked the orders paid but failed to finalize the
    // payment record, retry finalization without creating new orders.
    if (!newlyPaidOrders.length) {
      const { data: existingOrders, error: lookupError } = await supabaseAdmin
        .from('orders')
        .select('id, payment_status')
        .eq('checkout_group_id', claimedPayment.checkout_group_id);
      if (lookupError) throw lookupError;
      if (!existingOrders?.length || !existingOrders.every((order) => order.payment_status === 'paid')) {
        throw new Error('Cannot finalize payment without matching paid orders.');
      }
    }

    const { error: successError } = await supabaseAdmin
      .from('payments')
      .update({ status: 'success', raw_response: data })
      .eq('id', claimedPayment.id)
      .eq('status', 'processing');
    if (successError) throw successError;
  } catch (err) {
    // Retry on Paystack webhook redelivery if the database was unavailable.
    // Never undo already-confirmed customer charges.
    await supabaseAdmin.from('payments')
      .update({ status: 'pending' })
      .eq('id', claimedPayment.id)
      .eq('status', 'processing');
    throw err;
  }

  // Non-financial tasks are best-effort and must not roll back a verified
  // payment or cause the webhook to claim the customer was not charged.
  for (const order of newlyPaidOrders) {
    try {
      await removePurchasedCartLines(supabaseAdmin, order);
    } catch (err) {
      console.error('Post-payment cart cleanup failed', { orderId: order.id, message: err.message });
    }

    try {
      const { error: customerNoticeError } = await supabaseAdmin.from('notifications').insert({
        user_id: order.user_id,
        title: 'Payment received',
        body: `Your payment for order #${order.id.slice(0, 8)} was successful.`,
        type: 'payment',
      });
      if (customerNoticeError) throw customerNoticeError;

      const { data: restaurant, error: restaurantError } = await supabaseAdmin
        .from('restaurants')
        .select('owner_id')
        .eq('id', order.restaurant_id)
        .single();
      if (restaurantError) throw restaurantError;
      if (restaurant) {
        const { error: restaurantNoticeError } = await supabaseAdmin.from('notifications').insert({
          user_id: restaurant.owner_id,
          title: 'New paid order',
          body: `A paid order #${order.id.slice(0, 8)} is ready to prepare.`,
          type: 'order_update',
        });
        if (restaurantNoticeError) throw restaurantNoticeError;
      }
    } catch (err) {
      console.error('Payment notification failed', { orderId: order.id, message: err.message });
    }
  }
}

async function handleRiderTransferEvent(event, data) {
  if (!data?.reference?.startsWith('rider_payout_')) return;
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, rider_payout_amount, rider_payout_reference, rider_payout_status')
    .eq('rider_payout_reference', data.reference)
    .maybeSingle();
  if (error) throw error;
  if (!order) throw new Error('Unknown Delixious rider payout reference.');
  assertMatchingRiderTransfer(data, order);

  const isReversal = event === 'transfer.reversed';
  const newStatus = event === 'transfer.success' ? 'paid' : 'failed';
  let update = supabaseAdmin.from('orders')
    .update({ rider_payout_status: newStatus })
    .eq('id', order.id)
    .eq('rider_payout_reference', data.reference);
  // Paystack can reverse a transfer after an earlier success notification.
  update = isReversal
    ? update.in('rider_payout_status', ['processing', 'paid'])
    : update.eq('rider_payout_status', 'processing');
  const { error: updateError } = await update;
  if (updateError) throw updateError;
}

export async function paystackWebhook(req, res, next) {
  try {
    const signature = req.headers['x-paystack-signature'];
    const expectedSignature = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(req.rawBody || Buffer.from(JSON.stringify(req.body)))
      .digest('hex');

    const signed = typeof signature === 'string' && /^[a-f0-9]{128}$/i.test(signature)
      ? Buffer.from(signature, 'hex')
      : null;
    const expected = Buffer.from(expectedSignature, 'hex');
    if (!signed || !crypto.timingSafeEqual(signed, expected)) {
      return res.status(401).json({ error: 'Invalid signature.' });
    }

    if (req.body.event === 'charge.success') {
      await handleSuccessfulPayment(req.body.data);
    } else if (['transfer.success', 'transfer.failed', 'transfer.reversed'].includes(req.body.event)) {
      await handleRiderTransferEvent(req.body.event, req.body.data);
    }
    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
}

export async function verifyPayment(req, res, next) {
  try {
    const { reference } = req.params;
    const { data: payment } = await supabaseAdmin.from('payments').select('*').eq('reference', reference).maybeSingle();
    if (!payment) return res.status(404).json({ error: 'Payment reference not found.' });

    const { data: anOrder } = await supabaseAdmin
      .from('orders')
      .select('user_id')
      .eq('checkout_group_id', payment.checkout_group_id)
      .limit(1)
      .maybeSingle();
    if (!anOrder) return res.status(404).json({ error: 'No matching order exists for this payment.' });
    if (anOrder.user_id !== req.user.id && req.profile.role !== 'admin') return res.status(403).json({ error: 'You do not have access to this payment.' });

    const verification = await verifyTransaction(reference);
    if (!verification.status || verification.data?.reference !== reference) {
      return res.status(502).json({ error: 'Payment verification returned an invalid reference.' });
    }
    if (verification.data.status === 'success') {
      await handleSuccessfulPayment(verification.data);
    } else if (verification.data.status === 'failed') {
      await supabaseAdmin.from('payments').update({ status: 'failed', raw_response: verification.data }).eq('reference', reference).eq('status', 'pending');
      await supabaseAdmin.from('orders').update({ payment_status: 'failed' }).eq('checkout_group_id', payment.checkout_group_id).eq('payment_status', 'pending');
    }

    res.json({ status: verification.data.status });
  } catch (err) {
    next(err);
  }
}

export async function getBanks(req, res, next) {
  try {
    const result = await listBanks();
    const banks = (result.data || []).map((b) => ({ name: b.name, code: b.code }));
    res.json({ banks });
  } catch (err) {
    next(err);
  }
}
