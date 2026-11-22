/**
 * Check that a successful Paystack charge matches the amount and currency
 * the server originally recorded. Provider amounts are in kobo, records in NGN.
 * This must run before any order is marked paid or payout is initiated.
 */
export function assertVerifiedPaystackPayment(transaction, payment) {
  const expectedNaira = Number(payment?.amount);
  const expectedKobo = Math.round(expectedNaira * 100);
  const actualKobo = Number(transaction?.amount);

  const matches =
    transaction?.status === 'success' &&
    transaction?.reference === payment?.reference &&
    transaction?.currency === 'NGN' &&
    Number.isFinite(expectedNaira) &&
    expectedNaira > 0 &&
    Number.isSafeInteger(expectedKobo) &&
    Number.isSafeInteger(actualKobo) &&
    actualKobo === expectedKobo;

  if (!matches) {
    const error = new Error('Verified payment does not match the stored checkout reference, amount or NGN currency.');
    error.code = 'PAYMENT_MISMATCH';
    throw error;
  }
  return true;
}


/**
 * Validate the exact dynamic multi-split Paystack applied before fulfillment.
 * Paystack reports all amounts in kobo. The main account bears the processing fee.
 */
export function assertPaystackSplitMatchesOrders(transaction, orders) {
  const split = transaction?.split;
  const formula = split?.formula;
  const shares = split?.shares;
  if (!split || formula?.type !== 'flat' || formula?.bearer_type !== 'account' ||
      !Array.isArray(formula.subaccounts) || !Array.isArray(shares?.subaccounts)) {
    const error = new Error('Paystack did not return the expected dynamic split details. Payment requires manual reconciliation.');
    error.code = 'SPLIT_VERIFICATION_MISSING';
    throw error;
  }

  const expected = new Map();
  for (const order of orders || []) {
    const code = order.restaurant_paystack_subaccount_code;
    const amount = Math.round(Number(order.restaurant_net_amount) * 100);
    if (typeof code !== 'string' || !code.trim() || !Number.isSafeInteger(amount) || amount <= 0) {
      const error = new Error('An order is missing its restaurant subaccount or valid split amount.');
      error.code = 'SPLIT_ALLOCATION_INVALID';
      throw error;
    }
    expected.set(code, (expected.get(code) || 0) + amount);
  }

  const formulaMap = new Map(formula.subaccounts.map(item => [item.subaccount_code, Number(item.share)]));
  const actualMap = new Map(shares.subaccounts.map(item => [item.subaccount_code, Number(item.amount)]));
  const sameEntries = map => map.size === expected.size && [...expected].every(([code, amount]) => map.get(code) === amount);
  if (!sameEntries(formulaMap) || !sameEntries(actualMap)) {
    const error = new Error('Paystack split shares do not match the restaurant amounts stored on this checkout.');
    error.code = 'SPLIT_ALLOCATION_MISMATCH';
    throw error;
  }

  const total = Number(transaction.amount);
  const platformShare = Number(shares.integration);
  const providerFee = shares.paystack == null ? 0 : Number(shares.paystack);
  const subaccountTotal = [...actualMap.values()].reduce((sum, amount) => sum + amount, 0);
  if (![total, platformShare, providerFee].every(Number.isSafeInteger) ||
      total <= 0 || platformShare < 0 || providerFee < 0 ||
      platformShare + providerFee + subaccountTotal !== total) {
    const error = new Error('Paystack split shares and processing fee do not reconcile to the verified payment amount.');
    error.code = 'SPLIT_TOTAL_MISMATCH';
    throw error;
  }
  return true;
}
