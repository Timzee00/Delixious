import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/supabase.js', () => ({ supabaseAdmin: { from: vi.fn() } }));
vi.mock('../src/utils/paystack.js', () => ({ initiateTransfer: vi.fn() }));

import { supabaseAdmin } from '../src/config/supabase.js';
import { listAvailableDeliveries } from '../src/controllers/delivery.controller.js';

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}
function queryWith(result) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(result),
  };
  supabaseAdmin.from.mockReturnValue(query);
  return query;
}

describe('rider discovery pagination and authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects unapproved riders without reading customer delivery addresses', async () => {
    const req = { profile: { role: 'delivery_agent', rider_approval_status: 'pending' }, query: { page: 1, limit: 20 } };
    const res = response();
    const next = vi.fn();
    await listAvailableDeliveries(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('applies paid-order filters and bounded range in SQL, with rider payout fields', async () => {
    const query = queryWith({ data: [{ order_id: 'order1' }], count: 35, error: null });
    const res = response();
    const next = vi.fn();
    await listAvailableDeliveries({
      profile: { role: 'delivery_agent', rider_approval_status: 'approved' },
      query: { page: 2, limit: 20 },
    }, res, next);
    expect(query.select.mock.calls[0][0]).toContain('rider_payout_amount');
    expect(query.select.mock.calls[0][1]).toEqual({ count: 'exact' });
    expect(query.eq).toHaveBeenCalledWith('orders.payment_status', 'paid');
    expect(query.in).toHaveBeenCalledWith('orders.status', ['confirmed', 'preparing', 'out_for_delivery']);
    expect(query.range).toHaveBeenCalledWith(20, 39);
    expect(res.json).toHaveBeenCalledWith({ deliveries: [{ order_id: 'order1' }], total: 35, page: 2, limit: 20 });
    expect(next).not.toHaveBeenCalled();
  });
});
