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
    .select('restaurant_commission_bps,updated_at')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return data;
}

export async function walletOverview(req, res, next) {
  try {
    const [walletResult, identityResult, settings] = await Promise.all([
      supabaseAdmin.from('wallet_accounts')
        .select('id,kind,restaurant_id,currency,status,created_at,restaurants(name)')
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

    const walletIds = (walletResult.data || []).map(wallet => wallet.id);
    let balanceRows = [];
    if (walletIds.length) {
      const { data, error } = await supabaseAdmin
        .from('wallet_account_ledger_balances')
        .select('wallet_account_id,wallet_bucket,balance_kobo')
        .in('wallet_account_id', walletIds);
      if (error) throw error;
      balanceRows = data || [];
    }
    const wallets = (walletResult.data || []).map(wallet => {
      const balances = balanceRows.filter(row => row.wallet_account_id === wallet.id);
      const amount = bucket => Number(balances.find(row => row.wallet_bucket === bucket)?.balance_kobo || 0);
      return {
        ...wallet,
        balance_kobo: amount('available'),
        pending_kobo: amount('pending'),
        held_kobo: amount('held'),
      };
    });

    res.set('Cache-Control', 'private, no-store');
    res.json({
      wallets,
      verification: identityResult.data || { status: 'unverified', verified_at: null },
      settings,
      capabilities: CAPABILITIES,
      message: 'Balances are calculated from the append-only financial ledger. Funding, wallet checkout and withdrawals remain disabled until the regulated settlement integration is approved.',
    });
  } catch (err) { next(err); }
}

function encodeWalletCursor(row) {
  return Buffer.from(JSON.stringify({ created_at: row.created_at, id: row.id })).toString('base64url');
}

function decodeWalletCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.created_at !== 'string' ||
        !Number.isFinite(Date.parse(parsed.created_at)) ||
        typeof parsed.id !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(parsed.id)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function walletActivity(req, res, next) {
  try {
    const { wallet_id } = req.query;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 15));
    const cursor = decodeWalletCursor(req.query.cursor);
    if (req.query.cursor && !cursor) return res.status(400).json({ error: 'Invalid wallet activity cursor.' });

    // Explicit ownership check is required because this API uses the service role.
    const accountQuery = supabaseAdmin.from('wallet_accounts').select('id')
      .eq('owner_user_id', req.user.id);
    const { data: account, error: accountError } = wallet_id
      ? await accountQuery.eq('id', wallet_id).maybeSingle()
      : await accountQuery.order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (accountError) throw accountError;
    if (!account) return res.status(404).json({ error: 'Wallet not found.' });

    let query = supabaseAdmin.from('financial_journal_lines')
      .select('id,side,amount_kobo,created_at,financial_accounts!inner(wallet_account_id,wallet_bucket),financial_journals!inner(id,source_type,source_id,description,idempotency_key)')
      .eq('financial_accounts.wallet_account_id', account.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);
    if (cursor) {
      query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const activity = pageRows.map(entry => ({
      id: entry.id,
      delta_kobo: entry.side === 'credit' ? Number(entry.amount_kobo) : -Number(entry.amount_kobo),
      created_at: entry.created_at,
      wallet_bucket: entry.financial_accounts?.wallet_bucket,
      wallet_transactions: {
        kind: entry.financial_journals?.source_type,
        description: entry.financial_journals?.description,
        provider_reference: entry.financial_journals?.source_id,
      },
    }));
    const last = pageRows[pageRows.length - 1];
    res.set('Cache-Control', 'private, no-store');
    res.json({
      wallet_id: account.id,
      activity,
      has_more: hasMore,
      next_cursor: hasMore && last ? encodeWalletCursor(last) : null,
      limit,
    });
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
    const { restaurant_commission_bps } = req.body;
    const { data, error } = await supabaseAdmin.from('wallet_settings')
      .update({
        restaurant_commission_bps,
        updated_at: new Date().toISOString(),
        updated_by: req.user.id,
      })
      .eq('id', 1).select().single();
    if (error) throw error;
    res.json({ settings: data });
  } catch (err) { next(err); }
}
