import { describe, expect, it } from 'vitest';
import { buildOrderPaymentJournal } from '../src/utils/orderPaymentJournal.js';

const payment = {
  reference: 'delixious_payment_123',
  checkout_group_id: 'group-123',
  amount: 11000,
};
const orders = [{
  id: 'order-1',
  restaurant_id: 'restaurant-1',
  restaurant_wallet_account_id: 'a0b1c2d3-e4f5-4678-9abc-def012345678',
  total_amount: 11000,
  restaurant_net_amount: 9000,
  rider_payout_amount: 1000,
  platform_commission: 1000,
}];

describe('order payment journal allocation', () => {
  it('builds a balanced clearing, restaurant, rider and commission journal', () => {
    const journal = buildOrderPaymentJournal(payment, orders);
    expect(journal.idempotencyKey).toBe('paystack-charge:delixious_payment_123');
    expect(journal.lines.reduce((sum, line) => sum + (line.side === 'debit' ? line.amountKobo : -line.amountKobo), 0)).toBe(0);
    expect(journal.lines).toHaveLength(4);
  });

  it('supports zero rider payout or zero platform commission without zero-value lines', () => {
    const journal = buildOrderPaymentJournal({ ...payment, amount: 10000 }, [{
      ...orders[0], total_amount: 10000, restaurant_net_amount: 10000,
      rider_payout_amount: 0, platform_commission: 0,
    }]);
    expect(journal.lines).toHaveLength(2);
  });

  it('rejects an order whose internal allocation does not reconcile', () => {
    expect(() => buildOrderPaymentJournal(payment, [{
      ...orders[0], restaurant_net_amount: 8999,
    }])).toThrow(/does not reconcile/i);
  });

  it('rejects checkout orders that do not equal the verified charge', () => {
    expect(() => buildOrderPaymentJournal(payment, [{
      ...orders[0], total_amount: 10000, restaurant_net_amount: 8000,
    }])).toThrow(/do not match/i);
  });

  it('rejects invalid money values', () => {
    expect(() => buildOrderPaymentJournal(payment, [{
      ...orders[0], platform_commission: 'NaN',
    }])).toThrow(/Invalid platform commission/i);
  });
});
