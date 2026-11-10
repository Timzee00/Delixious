import { describe, it, expect } from 'vitest';
import { calculateOrderAllocation } from '../src/utils/walletPricing.js';

const settings = {
  restaurant_commission_bps: 1000,
  rider_commission_bps: 1000,
  restaurant_delivery_fee_kobo: 50000,
};

describe('restaurant-funded delivery allocation', () => {
  it('never adds the delivery fee to the customer total', () => {
    const quote = calculateOrderAllocation(500000, settings);
    expect(quote.customerTotalKobo).toBe(500000);
    expect(quote.customerDeliveryFeeKobo).toBe(0);
    expect(quote.restaurantShareKobo).toBe(400000);
    expect(quote.riderPayoutKobo).toBe(45000);
    expect(quote.platformGrossCommissionKobo).toBe(55000);
    expect(quote.restaurantShareKobo + quote.riderPayoutKobo + quote.platformGrossCommissionKobo).toBe(500000);
  });
  it('enforces minimum restaurant settlement', () => {
    expect(() => calculateOrderAllocation(50000, settings)).toThrow(/does not cover/);
  });
  it('rejects negative and fractional money', () => {
    expect(() => calculateOrderAllocation(-1, settings)).toThrow(/Invalid/);
    expect(() => calculateOrderAllocation(50000.5, settings)).toThrow(/Invalid/);
  });
  it('supports zero commissions and zero delivery', () => {
    const quote = calculateOrderAllocation(190000, {
      restaurant_commission_bps: 0,
      rider_commission_bps: 0,
      restaurant_delivery_fee_kobo: 0,
    });
    expect(quote.restaurantShareKobo).toBe(190000);
    expect(quote.riderPayoutKobo).toBe(0);
  });
});
