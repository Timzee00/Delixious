import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/supabase.js', () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { supabaseAdmin } from '../src/config/supabase.js';
import {
  walletActivity, requestWalletFunding, requestWalletWithdrawal,
} from '../src/controllers/wallet.controller.js';

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}
function mockVerification(status) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { status }, error: null }),
  };
  supabaseAdmin.from.mockReturnValue(query);
}

describe('Wallet API safety before a licensed provider is integrated', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not accept unverified withdrawal requests', async () => {
    mockVerification('unverified');
    const res = response();
    await requestWalletWithdrawal({ user: { id: 'customer-1' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].code).toBe('WALLET_VERIFICATION_REQUIRED');
  });

  it('never debits even a verified user while payouts are disabled', async () => {
    mockVerification('verified');
    const res = response();
    await requestWalletWithdrawal({ user: { id: 'customer-1' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json.mock.calls[0][0].code).toBe('WALLET_PROVIDER_NOT_CONNECTED');
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });

  it('does not invent a funding account or accept unverified deposits', async () => {
    const res = response();
    await requestWalletFunding({}, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('requires wallet ownership before querying financial history', async () => {
    const walletQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    supabaseAdmin.from.mockReturnValue(walletQuery);
    const req = {
      user: { id: 'customer-1' },
      query: { wallet_id: '8a04c779-2f3d-4c06-a949-98fab722bb01', page: 1 },
    };
    const res = response();
    await walletActivity(req, res, vi.fn());
    expect(walletQuery.eq).toHaveBeenCalledWith('owner_user_id', 'customer-1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });
});
