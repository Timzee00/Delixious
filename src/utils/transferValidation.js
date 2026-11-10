/**
 * Protect payout state updates against unrelated or malformed Paystack
 * transfer notifications. Transfer amounts are sent in kobo.
 */
export function assertMatchingRiderTransfer(transfer, order) {
  const expectedAmount = Math.round(Number(order?.rider_payout_amount) * 100);
  const actualAmount = Number(transfer?.amount);
  if (!transfer ||
      !order ||
      transfer.reference !== order.rider_payout_reference ||
      transfer.currency !== 'NGN' ||
      !Number.isSafeInteger(expectedAmount) ||
      expectedAmount <= 0 ||
      !Number.isSafeInteger(actualAmount) ||
      actualAmount !== expectedAmount) {
    throw new Error('Transfer reference, amount or currency does not match the rider payout.');
  }
  return true;
}
