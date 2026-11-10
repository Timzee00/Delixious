import { supabaseAdmin } from '../config/supabase.js';

// A wallet row is only an accounting shell until a regulated settlement
// partner is approved and wired. Never infer a deposit from client requests.
const CAPABILITIES = Object.freeze({
  funding: false,
  bank_account: false,
  wallet_checkout: false,
  withdrawals: false,
});

async function loadWalletSettings() {
  const { data, error } = await supabaseAdmin
    .from('wallet_settings')
    .select('restaurant_commission_bps,rider_commission_bps,restaurant_delivery_fee_kobo,updated_at')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return data;
}

export async function walletOverview(req, res, next) {
  try {
    const [walletResult, identityResult, settings] = await Promise.all([
      supabaseAdmin.from('wallet_accounts')
        .select('id,kind,restaurant_id,currency,balance_kobo,pending_kobo,held_kobo,status,restaurants(name)')
        .eq('owner_user_id', req.user.id)
        .order('created_at', { ascending: true }),
      supabaseAdmin.from('wallet_verifications')
        .select('status,verified_at')
        .eq('user_id', req.user.id)
        .maybeSingle(),
      loadWalletSettings(),
    ]);
    if (walletResult.error) throw walletResult.error;
    if (identityResult.error) throw identityResult.error;

    res.json({
      wallets: walletResult.data || [],
      verification: identityResult.data || { status: 'unverified', verified_at: null },
      settings,
      capabilities: CAPABILITIES,
      message: 'Wallet balances are not live until a regulated wallet provider is connected.',
    });
  } catch (err) { next(err); }
}

export async function walletActivity(req, res, next) {
  try {
    const { wallet_id } = req.query;
    const page = Math.min(100, Math.max(1, Number(req.query.page) || 1));
    const limit = 15;

    // Explicit account ownership check; the server Supabase service role bypasses RLS.
    const accountQuery = supabaseAdmin.from('wallet_accounts').select('id')
      .eq('owner_user_id', req.user.id);
    const { data: account, error: accountError } = wallet_id
      ? await accountQuery.eq('id', wallet_id).maybeSingle()
      : await accountQuery.order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (accountError) throw accountError;
    if (!account) return res.status(404).json({ error: 'Wallet not found.' });

    const { data, error, count } = await supabaseAdmin.from('wallet_entries')
      .select('id,delta_kobo,balance_after_kobo,created_at,wallet_transactions(kind,description,provider_reference)', { count: 'exact' })
      .eq('account_id', account.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw error;
    res.json({ wallet_id: account.id, activity: data || [], total: count || 0, page, limit });
  } catch (err) { next(err); }
}

export async function walletWithdrawals(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin.from('wallet_withdrawal_requests')
      .select('id,account_id,amount_kobo,state,account_last4,created_at')
      .eq('owner_user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    res.json({ withdrawals: data || [] });
  } catch (err) { next(err); }
}

export async function requestWalletFunding(req, res) {
  return res.status(503).json({
    code: 'WALLET_PROVIDER_NOT_CONNECTED',
    error: 'Wallet funding is not available yet. You can continue paying for orders through Paystack.',
  });
}

export async function requestWalletWithdrawal(req, res, next) {
  try {
    const { data: identity, error } = await supabaseAdmin.from('wallet_verifications')
      .select('status').eq('user_id', req.user.id).maybeSingle();
    if (error) throw error;
    if (identity?.status !== 'verified') {
      return res.status(403).json({
        code: 'WALLET_VERIFICATION_REQUIRED',
        error: 'Identity verification is required before wallet withdrawal.',
      });
    }
    return res.status(503).json({
      code: 'WALLET_PROVIDER_NOT_CONNECTED',
      error: 'Withdrawals are not yet enabled. No funds have been debited.',
    });
  } catch (err) { next(err); }
}

export async function adminWalletSettings(req, res, next) {
  try {
    const { restaurant_commission_bps, rider_commission_bps, restaurant_delivery_fee_kobo } = req.body;
    const { data, error } = await supabaseAdmin.from('wallet_settings')
      .update({
        restaurant_commission_bps,
        rider_commission_bps,
        restaurant_delivery_fee_kobo,
        updated_at: new Date().toISOString(),
        updated_by: req.user.id,
      })
      .eq('id', 1).select().single();
    if (error) throw error;
    res.json({ settings: data });
  } catch (err) { next(err); }
}
