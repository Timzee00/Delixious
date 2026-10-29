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
