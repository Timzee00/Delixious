import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../lib/api.js';

const formatNaira = (kobo = 0) => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency: 'NGN', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(kobo) / 100);

const KIND_LABELS = { customer: 'Personal wallet', restaurant: 'Restaurant wallet', rider: 'Rider wallet' };

function Icon({ name, size = 20, className = '' }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, className };
  const shapes = {
    wallet: <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 9h18" /><path d="M16 14h2" /></>,
    arrowUp: <><path d="m7 17 10-10M8 7h9v9" /></>,
    arrowDown: <><path d="m7 7 10 10M7 17h9V8" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14-5L4 8M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14 5l2-2m0 4v-4h-4" /></>,
    store: <><path d="m3 10 2-7h14l2 7v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0v-2ZM5 16v5h14v-5" /></>,
    bike: <><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="m12 17.5-4-8h6l4.5 8M9.5 11l-4 6.5M13 7h3" /></>,
    receipt: <><path d="M4 3h16v18l-4-2-4 2-4-2-4 2V3Z" /><path d="M8 8h8M8 12h6" /></>,
    bank: <><path d="m3 10 9-7 9 7M4 10h16M6 10v9m4-9v9m4-9v9m4-9v9M3 21h18" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7h.01" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" /><circle cx="16" cy="17" r="2" fill="currentColor" stroke="none" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg {...common}>{shapes[name] || shapes.wallet}</svg>;
}

function InfoCard({ icon, label, value, note }) {
  return (
    <div className="rounded-2xl border border-hairline bg-paper p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2 text-sm text-ink-soft"><Icon name={icon} size={17} /> {label}</div>
      <p className="mt-3 font-display text-2xl font-bold tracking-tight text-ink sm:text-[26px]">{value}</p>
      <p className="mt-2 text-xs text-ink-soft">{note}</p>
    </div>
  );
}

function Action({ icon, label, note, enabled }) {
  return (
    <button type="button" disabled={!enabled}
      title={enabled ? label : 'Available after wallet provider activation'}
      className="flex min-w-0 flex-1 flex-col items-center gap-2 rounded-xl border border-hairline bg-paper px-3 py-4 text-center disabled:cursor-not-allowed disabled:opacity-60">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sand text-pepper"><Icon name={icon} /></span>
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="text-[11px] leading-4 text-ink-soft">{note}</span>
    </button>
  );
}

function AdminFeeSettings({ settings, onSave }) {
  const [restaurantRate, setRestaurantRate] = useState(String((settings?.restaurant_commission_bps || 0) / 100));
  const [riderRate, setRiderRate] = useState(String((settings?.rider_commission_bps || 0) / 100));
  const [delivery, setDelivery] = useState(String((settings?.restaurant_delivery_fee_kobo || 0) / 100));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!settings) return;
    setRestaurantRate(String(settings.restaurant_commission_bps / 100));
    setRiderRate(String(settings.rider_commission_bps / 100));
    setDelivery(String(settings.restaurant_delivery_fee_kobo / 100));
  }, [settings]);

  async function save(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    const values = [Number(restaurantRate), Number(riderRate), Number(delivery)];
    if (!values.every(Number.isFinite) || values[0] < 0 || values[0] > 30 || values[1] < 0 || values[1] > 30 || values[2] < 0 || values[2] > 20000) {
      setError('Commission rates must be between 0 and 30%, and delivery cost between ₦0 and ₦20,000.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch('/wallet/settings', {
        restaurant_commission_bps: Math.round(values[0] * 100),
        rider_commission_bps: Math.round(values[1] * 100),
        restaurant_delivery_fee_kobo: Math.round(values[2] * 100),
      });
      onSave(data.settings);
      setMessage('Commission settings saved. Changes apply to new checkouts only.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update wallet settings.');
    } finally { setSaving(false); }
  }

  return (
    <section className="mt-6 rounded-2xl border border-hairline bg-paper p-5 sm:p-6" aria-labelledby="wallet-fees-title">
      <div className="flex items-center gap-2"><Icon name="settings" className="text-pepper" /><h2 id="wallet-fees-title" className="font-display text-lg font-semibold text-ink">Marketplace fees</h2></div>
      <p className="mt-2 text-sm text-ink-soft">Admin settings for future orders. Delivery is deducted from the restaurant settlement, not added to customer checkout.</p>
      <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-3">
        {[
          ['Restaurant commission (%)', restaurantRate, setRestaurantRate, 30],
          ['Rider commission (%)', riderRate, setRiderRate, 30],
          ['Restaurant delivery cost (₦)', delivery, setDelivery, 20000],
        ].map(([label, value, setter, max]) => (
          <label key={label} className="block text-xs font-medium text-ink-soft">
            {label}
            <input type="number" min="0" max={max} step="0.01" required value={value} onChange={e => setter(e.target.value)}
              className="mt-2 w-full rounded-xl border border-hairline bg-paper px-3 py-3 text-base font-semibold text-ink focus:border-pepper focus:outline-none" />
          </label>
        ))}
        <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-soft">Provider transaction and withdrawal fees are separate.</p>
          <button type="submit" disabled={saving} className="rounded-xl bg-pepper px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pepper-dark disabled:opacity-60">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
      {error && <p role="alert" className="mt-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {message && <p role="status" className="mt-3 rounded-lg bg-jade-soft p-3 text-sm text-jade">{message}</p>}
    </section>
  );
}

export default function Wallet() {
  const { profile } = useAuth();
  const [overview, setOverview] = useState(null);
  const [activeId, setActiveId] = useState('');
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadOverview = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/wallet');
      setOverview(data);
      setActiveId(prev => data.wallets.some(w => w.id === prev) ? prev : data.wallets[0]?.id || '');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load your wallet.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const loadActivity = useCallback(async (walletId, nextPage = 1) => {
    if (!walletId) { setActivity([]); setTotal(0); return; }
    setActivityLoading(true);
    try {
      const { data } = await api.get('/wallet/activity', { params: { wallet_id: walletId, page: nextPage } });
      setActivity(data.activity || []);
      setTotal(data.total || 0);
      setPage(nextPage);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load wallet activity.');
    } finally { setActivityLoading(false); }
  }, []);

  useEffect(() => { loadActivity(activeId); }, [activeId, loadActivity]);

  const wallet = useMemo(() => overview?.wallets?.find(w => w.id === activeId), [overview, activeId]);
  const verification = overview?.verification?.status || 'unverified';
  const verified = verification === 'verified';
  const canFund = Boolean(overview?.capabilities?.funding);
  const canWithdraw = Boolean(overview?.capabilities?.withdrawals) && verified;

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-20 text-center text-sm text-ink-soft" role="status">Loading wallet…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pepper">Delixious account</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Wallet</h1>
          <p className="mt-2 text-sm text-ink-soft">Your balances, transactions and payout settings in one place.</p>
        </div>
        <button type="button" onClick={loadOverview} className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-paper px-4 py-2.5 text-sm font-medium text-ink hover:border-pepper">
          <Icon name="refresh" size={17} /> Refresh
        </button>
      </div>

      {error && <div role="alert" className="mt-5 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

      {overview && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-hairline bg-paper px-4 py-3">
          <Icon name="info" className="mt-0.5 shrink-0 text-pepper" size={19} />
          <p className="text-sm leading-6 text-ink-soft">Wallet setup is in progress. Balances shown here are ledger balances, not bank deposits. Funding, wallet payments and withdrawals will be activated after the payment-provider integration.</p>
        </div>
      )}

      {overview?.wallets?.length > 1 && (
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label="Select wallet">
          {overview.wallets.map(w => (
            <button type="button" key={w.id} onClick={() => setActiveId(w.id)}
              aria-pressed={w.id === activeId}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${w.id === activeId ? 'border-pepper bg-pepper text-white' : 'border-hairline bg-paper text-ink-soft hover:border-pepper'}`}>
              <Icon name={w.kind === 'restaurant' ? 'store' : w.kind === 'rider' ? 'bike' : 'wallet'} size={16} />
              {w.kind === 'restaurant' ? w.restaurants?.name || 'Restaurant' : KIND_LABELS[w.kind]}
            </button>
          ))}
        </div>
      )}

      {!wallet ? (
        <div className="mt-6 rounded-2xl border border-hairline bg-paper p-8 text-center">
          <Icon name="wallet" size={32} className="mx-auto text-pepper" />
          <h2 className="mt-4 font-display text-lg font-bold text-ink">Your wallet is being prepared</h2>
          <p className="mt-2 text-sm text-ink-soft">No wallet is available yet. Check back after your account setup is completed.</p>
        </div>
      ) : (
        <>
          <section className="mt-6 overflow-hidden rounded-[24px] bg-ink p-6 text-white shadow-lg sm:p-8" aria-label="Wallet balance">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-white/70"><Icon name="wallet" size={20} /><span className="text-sm">{wallet.kind === 'restaurant' ? wallet.restaurants?.name || 'Restaurant wallet' : KIND_LABELS[wallet.kind]}</span></div>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">NGN account</span>
            </div>
            <p className="mt-10 text-sm text-white/70">Available balance</p>
            <p className="mt-2 break-words font-display text-4xl font-bold tracking-tight sm:text-5xl">{formatNaira(wallet.balance_kobo)}</p>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-5">
              <span className="inline-flex items-center gap-2 text-xs text-white/75"><Icon name="shield" size={16} /> Secure account ledger</span>
              <span className="text-xs text-white/75">Wallet ID: {wallet.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </section>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
            <InfoCard label="Pending balance" icon="clock" value={formatNaira(wallet.pending_kobo)} note="Awaiting settlement" />
            <InfoCard label="On hold" icon="lock" value={formatNaira(wallet.held_kobo)} note="Reserved or under review" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Action icon="arrowDown" label="Add money" note="Coming after account activation" enabled={canFund} />
            <Action icon="arrowUp" label="Withdraw" note={verified ? 'Coming after account activation' : 'Financial verification required'} enabled={canWithdraw} />
          </div>

          <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
            <section className="min-w-0 overflow-hidden rounded-2xl border border-hairline bg-paper" aria-labelledby="activity-title">
              <div className="flex items-center justify-between gap-2 border-b border-hairline p-5 sm:px-6">
                <div><h2 id="activity-title" className="font-display text-lg font-semibold text-ink">Recent activity</h2><p className="mt-1 text-xs text-ink-soft">All movements are recorded in your wallet history.</p></div>
                <Icon name="receipt" className="text-ink-soft" />
              </div>
              {activityLoading ? (
                <div role="status" className="p-10 text-center text-sm text-ink-soft">Loading transactions…</div>
              ) : !activity.length ? (
                <div className="px-6 py-12 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sand text-pepper"><Icon name="receipt" size={26} /></span><p className="mt-4 font-semibold text-ink">No wallet transactions yet</p><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-ink-soft">Deposits, payments and settlements will appear here after wallet activation.</p></div>
              ) : (
                <div className="divide-y divide-hairline">
                  {activity.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-4 sm:px-6">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.delta_kobo >= 0 ? 'bg-jade-soft text-jade' : 'bg-sand text-pepper'}`}><Icon name={item.delta_kobo >= 0 ? 'arrowDown' : 'arrowUp'} size={18} /></span>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{item.wallet_transactions?.description || item.wallet_transactions?.kind?.replace(/_/g, ' ') || 'Wallet transaction'}</p><p className="mt-1 text-xs text-ink-soft">{new Date(item.created_at).toLocaleString('en-NG')}</p></div>
                      <span className={`shrink-0 text-sm font-semibold ${item.delta_kobo >= 0 ? 'text-jade' : 'text-ink'}`}>{item.delta_kobo >= 0 ? '+' : '−'}{formatNaira(Math.abs(item.delta_kobo))}</span>
                    </div>
                  ))}
                </div>
              )}
              {total > 15 && (
                <div className="flex items-center justify-between border-t border-hairline px-5 py-3">
                  <button disabled={page <= 1 || activityLoading} onClick={() => loadActivity(wallet.id, page - 1)} className="text-sm font-medium text-pepper disabled:text-ink-soft/50">Previous</button>
                  <span className="text-xs text-ink-soft">Page {page}</span>
                  <button disabled={page * 15 >= total || activityLoading} onClick={() => loadActivity(wallet.id, page + 1)} className="text-sm font-medium text-pepper disabled:text-ink-soft/50">Next</button>
                </div>
              )}
            </section>

            <div className="space-y-5">
              <section className="rounded-2xl border border-hairline bg-paper p-5" aria-labelledby="verification-title">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-jade-soft text-jade"><Icon name="shield" /></span><div><h2 id="verification-title" className="font-semibold text-ink">Financial verification</h2><p className="mt-0.5 text-xs capitalize text-ink-soft">{verification.replace(/_/g, ' ')}</p></div></div>
                <p className="mt-4 text-sm leading-6 text-ink-soft">{verified ? 'Your identity is recorded as verified. Withdrawals will become available when regulated payouts are enabled.' : 'Financial identity verification is required for withdrawals. In-app verification will be enabled with our payment partner.'}</p>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-sand px-3 py-2 text-xs text-ink-soft"><span>Withdrawal access</span><span className="font-semibold text-ink">{canWithdraw ? 'Enabled' : 'Not available yet'}</span></div>
              </section>

              <section className="rounded-2xl border border-hairline bg-paper p-5" aria-labelledby="bank-title">
                <div className="flex items-center gap-2"><Icon name="bank" className="text-pepper" /><h2 id="bank-title" className="font-semibold text-ink">Bank account</h2></div>
                <p className="mt-3 text-sm leading-6 text-ink-soft">Your wallet is not a bank account. A dedicated funding account and verified withdrawal destination will appear here after provider activation.</p>
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-hairline px-3 py-3 text-xs text-ink-soft"><Icon name="lock" size={16} /> Not yet connected</div>
              </section>
              <Link to="/profile" className="flex items-center justify-between rounded-xl border border-hairline bg-paper px-4 py-3 text-sm font-semibold text-ink hover:border-pepper">
                Account and profile settings <Icon name="chevron" size={18} />
              </Link>
            </div>
          </div>
        </>
      )}

      {profile?.role === 'admin' && overview?.settings && <AdminFeeSettings settings={overview.settings} onSave={settings => setOverview(prev => ({ ...prev, settings }))} />}
    </div>
  );
}
