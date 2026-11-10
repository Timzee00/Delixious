import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/supabase.js', () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { supabaseAdmin } from '../src/config/supabase.js';
import { cancelOrder, updateOrderStatus } from '../src/controllers/orders.controller.js';

function mockStoredOrder(order) {
  const single = vi.fn().mockResolvedValue({ data: order, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  supabaseAdmin.from.mockReturnValue({ select });
}

function mockResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

describe('paid and in-progress order cancellation safety', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses customer cancellation after payment was confirmed', async () => {
    mockStoredOrder({ id: 'order-1', user_id: 'customer-1', status: 'confirmed', payment_status: 'paid', payment_reference: 'payref' });
    const res = mockResponse();
    const next = vi.fn();
    await cancelOrder({ params: { id: 'order-1' }, user: { id: 'customer-1' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toMatch(/refund/);
    expect(next).not.toHaveBeenCalled();
  });

  it('refuses customer cancellation while Paystack authorization is pending', async () => {
    mockStoredOrder({ id: 'order-1', user_id: 'customer-1', status: 'pending', payment_status: 'pending', payment_reference: 'payref' });
    const res = mockResponse();
    await cancelOrder({ params: { id: 'order-1' }, user: { id: 'customer-1' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('refuses restaurant cancellation of an already-paid order', async () => {
    mockStoredOrder({ id: 'order-1', user_id: 'customer-1', status: 'confirmed', payment_status: 'paid', payment_reference: 'payref', restaurants: { owner_id: 'restaurant-1' } });
    const res = mockResponse();
    await updateOrderStatus({
      params: { id: 'order-1' },
      body: { status: 'cancelled' },
      user: { id: 'restaurant-1' },
      profile: { role: 'restaurant_owner' },
    }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toMatch(/refund/);
  });
});
