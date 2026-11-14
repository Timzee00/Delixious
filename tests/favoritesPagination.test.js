import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/supabase.js', () => ({ supabaseAdmin: { from: vi.fn() } }));

import { supabaseAdmin } from '../src/config/supabase.js';
import { listFavoriteRestaurants } from '../src/controllers/favorites.controller.js';

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

function queryWith(result) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(result),
  };
  supabaseAdmin.from.mockReturnValue(query);
  return query;
}

describe('favorite restaurant pagination', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only the requested page and exact count', async () => {
    const rows = [{ restaurant_id: 'r1', created_at: '2026-11-14', restaurants: { id: 'r1', name: 'Kitchen One' } }];
    const query = queryWith({ data: rows, count: 27, error: null });
    const res = response();

    await listFavoriteRestaurants({
      user: { id: 'customer-1' },
      query: { page: 2, limit: 12 },
    }, res, vi.fn());

    expect(supabaseAdmin.from).toHaveBeenCalledWith('restaurant_favorites');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'customer-1');
    expect(query.eq).toHaveBeenCalledWith('restaurants.approval_status', 'approved');
    expect(query.range).toHaveBeenCalledWith(12, 23);
    expect(res.json).toHaveBeenCalledWith({
      favorites: [{ id: 'r1', name: 'Kitchen One', favorite_created_at: '2026-11-14' }],
      restaurant_ids: ['r1'],
      total: 27,
      page: 2,
      limit: 12,
    });
  });

  it('scopes saved status to a bounded set of visible restaurant IDs', async () => {
    const query = queryWith({ data: [], count: 0, error: null });
    const res = response();

    await listFavoriteRestaurants({
      user: { id: 'customer-2' },
      query: { page: 1, limit: 12, restaurant_ids: 'r1,r2,r3' },
    }, res, vi.fn());

    expect(query.in).toHaveBeenCalledWith('restaurant_id', ['r1', 'r2', 'r3']);
    expect(query.range).toHaveBeenCalledWith(0, 11);
    expect(res.json).toHaveBeenCalledWith({
      favorites: [],
      restaurant_ids: [],
      total: 0,
      page: 1,
      limit: 12,
    });
  });

  it('filters saved restaurants by name in the database', async () => {
    const query = queryWith({ data: [], count: 0, error: null });
    const res = response();

    await listFavoriteRestaurants({
      user: { id: 'customer-3' },
      query: { page: 1, limit: 12, q: 'noodles' },
    }, res, vi.fn());

    expect(query.ilike).toHaveBeenCalledWith('restaurants.name', '%noodles%');
    expect(query.range).toHaveBeenCalledWith(0, 11);
  });
});
