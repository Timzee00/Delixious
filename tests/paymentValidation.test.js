import { describe, it, expect } from 'vitest';
import { assertVerifiedPaystackPayment } from '../src/utils/paymentValidation.js';

const stored = { reference: 'delixious_example', amount: '2500.50' };
const valid = { reference: 'delixious_example', status: 'success', amount: 250050, currency: 'NGN' };

describe('Paystack payment reconciliation guard', () => {
  it('accepts the full recorded naira amount in kobo, NGN and correct reference', () => {
    expect(assertVerifiedPaystackPayment(valid, stored)).toBe(true);
  });
  it.each([
    [{ ...valid, amount: 250049 }, 'underpayment'],
    [{ ...valid, amount: 250051 }, 'overpayment'],
    [{ ...valid, currency: 'USD' }, 'wrong currency'],
    [{ ...valid, reference: 'other' }, 'wrong reference'],
    [{ ...valid, status: 'pending' }, 'pending payment'],
    [{ ...valid, status: 'failed' }, 'failed payment'],
    [{ ...valid, amount: NaN }, 'non-numeric amount'],
    [{ ...valid, amount: 250050.5 }, 'fractional kobo'],
    [{ ...valid, currency: undefined }, 'missing currency'],
  ])('rejects %s (%s)', (transaction) => {
    expect(() => assertVerifiedPaystackPayment(transaction, stored)).toThrow(/does not match/);
  });
  it('rejects unusable stored totals', () => {
    expect(() => assertVerifiedPaystackPayment(valid, { ...stored, amount: 0 })).toThrow();
    expect(() => assertVerifiedPaystackPayment(valid, { ...stored, amount: 'bad' })).toThrow();
  });
});
