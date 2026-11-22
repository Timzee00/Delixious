function toKobo(value, label) {
  const naira = Number(value);
  const kobo = Math.round(naira * 100);
  if (!Number.isFinite(naira) || !Number.isSafeInteger(kobo) || kobo < 0) {
    throw new Error(`Invalid ${label} in financial order allocation.`);
  }
  return kobo;
}

export function buildOrderPaymentJournal(payment, orders) {
  if (!payment?.reference || !payment?.checkout_group_id || !Array.isArray(orders) || !orders.length) {
    throw new Error('A verified payment and its checkout orders are required for financial posting.');
  }

  const paymentAmountKobo = toKobo(payment.amount, 'payment amount');
  if (paymentAmountKobo <= 0) throw new Error('Payment amount must be greater than zero.');

  let orderTotalKobo = 0;
  let restaurantPayableKobo = 0;
  let riderPayableKobo = 0;
  let platformCommissionKobo = 0;

  const allocations = orders.map(order => {
    const totalKobo = toKobo(order.total_amount, 'order total');
    const restaurantKobo = toKobo(order.restaurant_net_amount, 'restaurant payable');
    const riderKobo = toKobo(order.rider_payout_amount, 'rider payable');
    const commissionKobo = toKobo(order.platform_commission, 'platform commission');

    if (restaurantKobo + riderKobo + commissionKobo !== totalKobo) {
      throw new Error(`Order ${order.id} allocation does not reconcile to its customer charge.`);
    }

    orderTotalKobo += totalKobo;
    restaurantPayableKobo += restaurantKobo;
    riderPayableKobo += riderKobo;
    platformCommissionKobo += commissionKobo;

    return {
      order_id: order.id,
      restaurant_id: order.restaurant_id,
      total_kobo: totalKobo,
      restaurant_payable_kobo: restaurantKobo,
      rider_payable_kobo: riderKobo,
      platform_commission_kobo: commissionKobo,
    };
  });

  if (orderTotalKobo !== paymentAmountKobo) {
    throw new Error('Checkout order totals do not match the verified Paystack payment.');
  }

  const lines = [
    { accountCode: 'SYS:PAYSTACK_CLEARING', side: 'debit', amountKobo: paymentAmountKobo },
    { accountCode: 'SYS:RESTAURANT_PAYABLE', side: 'credit', amountKobo: restaurantPayableKobo },
    { accountCode: 'SYS:RIDER_PAYABLE', side: 'credit', amountKobo: riderPayableKobo },
    { accountCode: 'SYS:PLATFORM_COMMISSION_REVENUE', side: 'credit', amountKobo: platformCommissionKobo },
  ].filter(line => line.amountKobo > 0);

  return {
    idempotencyKey: `paystack-charge:${payment.reference}`,
    sourceType: 'order_payment',
    sourceId: payment.checkout_group_id,
    description: `Verified customer payment ${payment.reference}`,
    lines,
    metadata: {
      provider: 'paystack',
      payment_reference: payment.reference,
      checkout_group_id: payment.checkout_group_id,
      allocations,
    },
  };
}
