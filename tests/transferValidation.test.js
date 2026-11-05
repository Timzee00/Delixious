import { describe, it, expect } from 'vitest';
import { assertMatchingRiderTransfer } from '../src/utils/transferValidation.js';

const order = { rider_payout_reference: 'rider_payout_test-123', rider_payout_amount: 450 };
const transfer = { reference: 'rider_payout_test-123', amount: 45000, currency: 'NGN' };

describe('rider payout webhook reconciliation', () => {
  it('accepts a matching transfer in NGN kobo', () => {
    expect(assertMatchingRiderTransfer(transfer, order)).toBe(true);
  });

  it.each([
    [{ ...transfer, amount: 450 }, 'wrong amount'],
    [{ ...transfer, amount: 45001 }, 'excess amount'],
    [{ ...transfer, reference: 'other' }, 'wrong reference'],
    [{ ...transfer, currency: 'USD' }, 'wrong currency'],
    [{ ...transfer, amount: null }, 'missing amount'],
  ])('rejects %s (%s)', (payload) => {
    expect(() => assertMatchingRiderTransfer(payload, order)).toThrow(/does not match/);
  });
});
