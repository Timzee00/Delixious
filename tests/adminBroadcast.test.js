import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/supabase.js', () => ({ supabaseAdmin: { from: vi.fn() } }));

import { supabaseAdmin } from '../src/config/supabase.js';
import { sendBroadcast } from '../src/controllers/admin.controller.js';

function response() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res;
}

function profileQuery(rows, count) {
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: rows, count, error: null }),
  };
}

describe('admin broadcast batching', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads a recipient page and reports the exact completed count', async () => {
    const query = profileQuery([{ id: 'user-1' }, { id: 'user-2' }], 2);
    const insert = vi.fn().mockResolvedValue({ error: null });
    supabaseAdmin.from.mockImplementation(table => table === 'profiles' ? query : { insert });

    const res = response();
    await sendBroadcast({
      body: { title: 'Service update', message: 'New marketplace hours.' },
    }, res, vi.fn());

    expect(query.range).toHaveBeenCalledWith(0, 499);
    expect(insert).toHaveBeenCalledWith([
      { user_id: 'user-1', type: 'broadcast', title: 'Service update', body: 'New marketplace hours.' },
      { user_id: 'user-2', type: 'broadcast', title: 'Service update', body: 'New marketplace hours.' },
    ]);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Broadcast sent to 2 user(s).',
      sent_count: 2,
      recipient_total: 2,
    });
  });

  it('reports partial delivery instead of claiming the broadcast completed', async () => {
    const rows = Array.from({ length: 201 }, (_, index) => ({ id: `user-${index + 1}` }));
    const query = profileQuery(rows, 201);
    const insert = vi.fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'database unavailable' } });
    supabaseAdmin.from.mockImplementation(table => table === 'profiles' ? query : { insert });

    const res = response();
    await sendBroadcast({
      body: { title: 'Notice', message: 'Please read.' },
    }, res, vi.fn());

    expect(insert).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      code: 'BROADCAST_PARTIAL_FAILURE',
      error: 'Broadcast stopped after a partial delivery. Review the sent count before retrying.',
      sent_count: 200,
      recipient_total: 201,
    });
  });
});
