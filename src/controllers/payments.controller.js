import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyTransaction, listBanks } from '../utils/paystack.js';
import { assertVerifiedPaystackPayment, assertPaystackSplitMatchesOrders } from '../utils/paymentValidation.js';
import { assertMatchingRiderTransfer } from '../utils/transferValidation.js';
import { removePurchasedCartLines } from '../utils/paidCartCleanup.js';
import { beginProviderEvent, finishProviderEvent } from '../utils/providerEventInbox.js';
import { buildOrderPaymentJournal } from '../utils/orderPaymentJournal.js';
import { postFinancialJournal } from '../services/financialLedger.js';
import { buildRiderSettlementJournal } from '../utils/riderWalletJournal.js';

async function handleSuccessfulPayment(data, { retryBusy = false, alreadyVerified = false } = {}) {
  const reference = data.reference;

  const { data: payment, error: paymentLookupError } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();

  if (paymentLookupError) throw paymentLookupError;
  if (!payment) throw new Error('Verified Paystack charge has no matching Delixious payment record. Manual reconciliation is required.');

  if (payment.status === 'success') return;

  // Verify with Paystack's API as well as the signed webhook. The webhook's
  // split details are retained when the verification response omits them.
  const verifiedResponse = alreadyVerified ? { status: true, data } : await verifyTransaction(reference);
  if (!verifiedResponse?.status || !verifiedResponse.data) {
    throw new Error('Paystack could not verify the successful charge.');
  }
  const transaction = {
    ...verifiedResponse.data,
    split: verifiedResponse.data.split || data.split,
  };
  assertVerifiedPaystackPayment(transaction, payment);
  const providerEnvironment = transaction.domain;
  if (!['test','live'].includes(providerEnvironment) || providerEnvironment !== payment.payment_environment) {
    const environmentError = new Error('Paystack payment environment does not match the environment recorded at checkout.');
    environmentError.code = 'PAYMENT_ENVIRONMENT_MISMATCH';
    throw environmentError;
  }

  const { data: checkoutOrders, error: checkoutError } = await supabaseAdmin
    .from('orders')
    .select('id, status, payment_status, restaurant_net_amount, restaurant_paystack_subaccount_code')
    .eq('checkout_group_id', payment.checkout_group_id);
  if (checkoutError) throw checkoutError;
  if (providerEnvironment === 'live') assertPaystackSplitMatchesOrders(transaction, checkoutOrders || []);
  if (!checkoutOrders?.length || checkoutOrders.some((order) =>
    order.status === 'cancelled' || order.payment_status === 'refunded')) {
    // Never silently resurrect cancelled/refunded orders when a late charge
    // arrives. Such transactions must be reviewed for a manual refund.
    throw new Error('Charged checkout requires manual reconciliation before fulfillment.');
  }

  // Atomically claim the payment so duplicate webhooks/verification calls do
  // not issue duplicate notifications or race the order state transition.
  const now = new Date();
  const nowIso = now.toISOString();
  const staleBefore = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  let claimQuery = supabaseAdmin.from('payments')
    .update({ status: 'processing', processing_started_at: nowIso, updated_at: nowIso, raw_response: transaction })
    .eq('id', payment.id);

  if (payment.status === 'pending' || payment.status === 'failed') {
    claimQuery = claimQuery.in('status', ['pending', 'failed']);
  } else if (payment.status === 'processing') {
    if (payment.processing_started_at && Date.parse(payment.processing_started_at) >= Date.parse(staleBefore)) {
      if (retryBusy) {
        const busyError = new Error('Payment finalization is already running. Paystack should retry this event.');
        busyError.code = 'PAYMENT_PROCESSING_BUSY';
        throw busyError;
      }
      return;
    }
    claimQuery = payment.processing_started_at
      ? claimQuery.eq('status', 'processing').lt('processing_started_at', staleBefore)
      : claimQuery.eq('status', 'processing').is('processing_started_at', null);
  } else {
    return;
  }

  const { data: claimedPayment, error: claimError } = await claimQuery.select('*').maybeSingle();
  if (claimError) throw claimError;
  if (!claimedPayment) {
    if (retryBusy) {
      const busyError = new Error('Payment finalization was claimed by another request. Paystack should retry this event.');
      busyError.code = 'PAYMENT_PROCESSING_BUSY';
      throw busyError;
    }
    return;
  }

  let newlyPaidOrders = [];
  let ledgerOrdersForNotifications = [];
  try {
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .update({ payment_status: 'paid', payment_environment: claimedPayment.payment_environment, status: 'confirmed' })
      .eq('checkout_group_id', claimedPayment.checkout_group_id)
      .in('payment_status', ['pending', 'failed'])
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

    // Financial posting is part of payment finalization. It is idempotent,
    // balanced and committed by a single database RPC. If it fails, the
    // payment remains retryable and the already-paid orders are reconciled
    // on the next verified webhook delivery.
    const { data: ledgerOrders, error: ledgerOrdersError } = await supabaseAdmin
      .from('orders')
      .select('id,user_id,restaurant_id,total_amount,restaurant_net_amount,rider_payout_amount,platform_commission')
      .eq('checkout_group_id', claimedPayment.checkout_group_id);
    if (ledgerOrdersError) throw ledgerOrdersError;
    ledgerOrdersForNotifications = ledgerOrders || [];
    const restaurantIds = [...new Set((ledgerOrders || []).map(order => order.restaurant_id))];
    const { data: restaurantWallets, error: walletLookupError } = await supabaseAdmin
      .from('wallet_accounts')
      .select('id,restaurant_id')
      .eq('kind', 'restaurant')
      .in('restaurant_id', restaurantIds);
    if (walletLookupError) throw walletLookupError;
    const walletByRestaurant = new Map((restaurantWallets || []).map(wallet => [wallet.restaurant_id, wallet.id]));
    const ordersWithWallets = (ledgerOrders || []).map(order => ({
      ...order,
      restaurant_wallet_account_id: walletByRestaurant.get(order.restaurant_id),
    }));
    if (claimedPayment.payment_environment === 'live') {
      const journal = buildOrderPaymentJournal(claimedPayment, ordersWithWallets);
      await postFinancialJournal(journal);
    }

    const { error: successError } = await supabaseAdmin
      .from('payments')
      .update({ status: 'success', processing_started_at: null, updated_at: new Date().toISOString(), raw_response: transaction })
      .eq('id', claimedPayment.id)
      .eq('status', 'processing');
    if (successError) throw successError;
  } catch (err) {
    // Retry on Paystack webhook redelivery if the database was unavailable.
    // Never undo already-confirmed customer charges.
    await supabaseAdmin.from('payments')
      .update({ status: 'pending', processing_started_at: null, updated_at: new Date().toISOString() })
      .eq('id', claimedPayment.id)
      .eq('status', 'processing');
    throw err;
  }

  // Non-financial tasks are best-effort and must not roll back a verified
  // payment or cause the webhook to claim the customer was not charged.
  for (const order of ledgerOrdersForNotifications) {
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

  const { data: payoutRecord, error: payoutLookupError } = await supabaseAdmin
    .from('financial_payouts')
    .select('id,status')
    .eq('provider_reference', data.reference)
    .maybeSingle();
  if (payoutLookupError) throw payoutLookupError;
  if (!payoutRecord) throw new Error('Rider payout queue record is missing.');
  if (payoutRecord.status === 'reversed' && event !== 'transfer.reversed') return;
  if (payoutRecord.status === 'paid' && event === 'transfer.failed') return;

  const { data: tracking, error: trackingError } = await supabaseAdmin
    .from('delivery_tracking')
    .select('delivery_agent_id')
    .eq('order_id', order.id)
    .maybeSingle();
  if (trackingError) throw trackingError;
  if (!tracking?.delivery_agent_id) throw new Error('Rider payout has no assigned rider.');

  const { data: riderWallet, error: walletError } = await supabaseAdmin
    .from('wallet_accounts')
    .select('id')
    .eq('owner_user_id', tracking.delivery_agent_id)
    .eq('kind', 'rider')
    .maybeSingle();
  if (walletError) throw walletError;
  if (!riderWallet) throw new Error('Rider payout wallet is missing.');

  const amountKobo = Math.round(Number(order.rider_payout_amount) * 100);
  if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
    throw new Error('Rider payout amount is invalid.');
  }

  if (event === 'transfer.success' || event === 'transfer.reversed') {
    // A reversal must first ensure the original successful payout is journaled.
    // Both entries are idempotent, so out-of-order provider events are safe.
    await postFinancialJournal(buildRiderSettlementJournal({
      reference: data.reference,
      amountKobo,
      riderWalletAccountId: riderWallet.id,
    }));
    if (event === 'transfer.reversed') {
      await postFinancialJournal(buildRiderSettlementJournal({
        reference: data.reference,
        amountKobo,
        riderWalletAccountId: riderWallet.id,
        reversed: true,
      }));
    }
  }

  const newStatus = event === 'transfer.success' ? 'paid' : event === 'transfer.reversed' ? 'reversed' : 'failed';
  const now = new Date().toISOString();
  const { error: payoutError } = await supabaseAdmin.from('financial_payouts')
    .update({
      status: newStatus,
      paid_at: event === 'transfer.success' ? now : null,
      provider_transfer_code: data.transfer_code || null,
      last_error_code: event === 'transfer.failed' ? 'PAYSTACK_TRANSFER_FAILED' : null,
      last_error_message: event === 'transfer.failed' ? String(data.reason || 'Paystack transfer failed').slice(0, 500) : null,
      updated_at: now,
    })
    .eq('provider_reference', data.reference)
    .in('status', ['processing','failed','paid']);
  if (payoutError) throw payoutError;

  const orderStatus = event === 'transfer.success' ? 'paid' : 'failed';
  const { error: orderUpdateError } = await supabaseAdmin.from('orders')
    .update({ rider_payout_status: orderStatus })
    .eq('id', order.id)
    .eq('rider_payout_reference', data.reference)
    .in('rider_payout_status', ['processing','failed','paid']);
  if (orderUpdateError) throw orderUpdateError;
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

    const eventName = req.body?.event;
    const eventData = req.body?.data;
    const inbox = await beginProviderEvent(eventName, eventData, req.rawBody);
    if (!inbox.claimed) {
      if (inbox.busy) return res.status(503).json({ error: 'This payment event is still being processed. Please retry.' });
      return res.sendStatus(200);
    }

    try {
      if (eventName === 'charge.success') {
        await handleSuccessfulPayment(eventData, { retryBusy: true });
        await finishProviderEvent(inbox.id, 'processed');
      } else if (['transfer.success', 'transfer.failed', 'transfer.reversed'].includes(eventName)) {
        await handleRiderTransferEvent(eventName, eventData);
        await finishProviderEvent(inbox.id, 'processed');
      } else {
        await finishProviderEvent(inbox.id, 'ignored');
      }
    } catch (processingError) {
      try {
        await finishProviderEvent(inbox.id, 'failed', processingError);
      } catch (inboxError) {
        console.error('Unable to mark Paystack event as failed', {
          eventId: inbox.id,
          message: inboxError.message,
        });
      }
      throw processingError;
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

    // A provider success does not necessarily mean our order bookkeeping
    // finished. Only show "confirmed" when our stored payment is finalized.
    const { data: finalPayment, error: finalError } = await supabaseAdmin
      .from('payments').select('status').eq('reference', reference).maybeSingle();
    if (finalError) throw finalError;
    const status = verification.data.status === 'success' && finalPayment?.status !== 'success'
      ? 'processing'
      : verification.data.status;
    res.json({ status });
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
