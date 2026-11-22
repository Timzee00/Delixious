export function buildRiderEarningJournal({ orderId, amountKobo, riderWalletAccountId }) {
  if (!orderId || !Number.isSafeInteger(amountKobo) || amountKobo <= 0 ||
      typeof riderWalletAccountId !== 'string' || !/^[0-9a-f-]{36}$/i.test(riderWalletAccountId)) {
    throw new Error('Invalid rider earning journal input.');
  }
  return {
    idempotencyKey: `rider-earning:${orderId}`,
    sourceType: 'rider_delivery_earning',
    sourceId: String(orderId),
    description: `Rider earning for order ${String(orderId).slice(0, 8)}`,
    lines: [
      { accountCode: 'SYS:RIDER_PAYABLE', side: 'debit', amountKobo },
      { accountCode: `WALLET:${riderWalletAccountId}:available`, side: 'credit', amountKobo },
    ],
    metadata: { order_id: orderId, rider_wallet_account_id: riderWalletAccountId },
  };
}

export function buildRiderSettlementJournal({ reference, amountKobo, riderWalletAccountId, reversed = false }) {
  if (!reference || !Number.isSafeInteger(amountKobo) || amountKobo <= 0 ||
      typeof riderWalletAccountId !== 'string' || !/^[0-9a-f-]{36}$/i.test(riderWalletAccountId)) {
    throw new Error('Invalid rider settlement journal input.');
  }
  return reversed ? {
    idempotencyKey: `rider-payout-reversal:${reference}`,
    sourceType: 'rider_payout_reversal',
    sourceId: String(reference),
    description: 'Reversed rider bank transfer',
    lines: [
      { accountCode: 'SYS:PAYSTACK_CLEARING', side: 'debit', amountKobo },
      { accountCode: `WALLET:${riderWalletAccountId}:available`, side: 'credit', amountKobo },
    ],
    metadata: { provider: 'paystack', transfer_reference: reference, reversed: true },
  } : {
    idempotencyKey: `rider-payout:${reference}`,
    sourceType: 'rider_payout',
    sourceId: String(reference),
    description: 'Confirmed rider bank payout',
    lines: [
      { accountCode: `WALLET:${riderWalletAccountId}:available`, side: 'debit', amountKobo },
      { accountCode: 'SYS:PAYSTACK_CLEARING', side: 'credit', amountKobo },
    ],
    metadata: { provider: 'paystack', transfer_reference: reference, reversed: false },
  };
}
