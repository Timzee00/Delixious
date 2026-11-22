import { describe, it, expect } from 'vitest';
import { assertVerifiedPaystackPayment, assertPaystackSplitMatchesOrders, assertPaystackPaymentEnvironment } from '../src/utils/paymentValidation.js';

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


describe('Paystack dynamic multi-split verification', () => {
  const orders = [
    { restaurant_paystack_subaccount_code: 'ACCT_A', restaurant_net_amount: 90 },
    { restaurant_paystack_subaccount_code: 'ACCT_B', restaurant_net_amount: 40 },
  ];
  const transaction = {
    amount: 15000,
    split: {
      formula: {
        type: 'flat',
        bearer_type: 'account',
        subaccounts: [
          { subaccount_code: 'ACCT_A', share: 9000 },
          { subaccount_code: 'ACCT_B', share: 4000 },
        ],
      },
      shares: {
        subaccounts: [
          { subaccount_code: 'ACCT_A', amount: 9000 },
          { subaccount_code: 'ACCT_B', amount: 4000 },
        ],
        integration: 1800,
        paystack: 200,
      },
    },
  };

  it('accepts an exact split and fee breakdown', () => {
    expect(assertPaystackSplitMatchesOrders(transaction, orders)).toBe(true);
  });

  it('rejects missing split data', () => {
    expect(() => assertPaystackSplitMatchesOrders({ amount: 15000 }, orders)).toThrow(/manual reconciliation/i);
  });

  it('rejects a subaccount amount mismatch', () => {
    const changed = structuredClone(transaction);
    changed.split.shares.subaccounts[0].amount = 8999;
    expect(() => assertPaystackSplitMatchesOrders(changed, orders)).toThrow(/do not match/i);
  });

  it('rejects an incorrect processing fee or platform remainder', () => {
    const changed = structuredClone(transaction);
    changed.split.shares.paystack = 999;
    expect(() => assertPaystackSplitMatchesOrders(changed, orders)).toThrow(/do not reconcile/i);
  });
});


describe('Paystack test/live environment isolation', () => {
  it('accepts a matching test payment environment', () => {
    expect(assertPaystackPaymentEnvironment({domain:'test'},{payment_environment:'test'})).toBe(true);
  });
  it('accepts a matching live payment environment', () => {
    expect(assertPaystackPaymentEnvironment({domain:'live'},{payment_environment:'live'})).toBe(true);
  });
  it.each([
    [{domain:'test'},{payment_environment:'live'}],
    [{domain:'live'},{payment_environment:'test'}],
    [{domain:'unknown'},{payment_environment:'test'}],
    [{domain:'test'},{}],
  ])('rejects a missing or mismatched environment', (transaction,payment) => {
    expect(() => assertPaystackPaymentEnvironment(transaction,payment)).toThrow(/environment does not match/i);
  });
});
