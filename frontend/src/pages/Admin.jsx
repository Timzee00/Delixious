import { useEffect, useState } from 'react';
import { adminApi } from '../lib/adminApi.js';
import StatsSection from '../components/admin/StatsSection.jsx';
import RestaurantsApprovalSection from '../components/admin/RestaurantsApprovalSection.jsx';
import RidersApprovalSection from '../components/admin/RidersApprovalSection.jsx';
import UsersSection from '../components/admin/UsersSection.jsx';
import BroadcastSection from '../components/admin/BroadcastSection.jsx';
import PaginationControls from '../components/ui/PaginationControls.jsx';
import Icon from '../components/ui/Icon.jsx';
import SceneIllustration from '../components/ui/SceneIllustration.jsx';

const TABS = [
  { id: 'Overview', label: 'Overview', icon: 'chart-no-axes-column' },
  { id: 'Restaurants', label: 'Restaurants', icon: 'store-front' },
  { id: 'Riders', label: 'Riders', icon: 'bike' },
  { id: 'Users', label: 'Users', icon: 'users' },
  { id: 'Orders', label: 'Orders', icon: 'clipboard-list' },
  { id: 'Broadcast', label: 'Broadcast', icon: 'bell' },
];

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending payment' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_STYLES = {
  pending: 'bg-gold/15 text-[#8A5A00]',
  confirmed: 'bg-gold/15 text-[#8A5A00]',
  preparing: 'bg-gold/15 text-[#8A5A00]',
  out_for_delivery: 'bg-pepper/10 text-pepper',
  delivered: 'bg-jade-soft text-jade',
  cancelled: 'bg-sand text-ink-soft',
};

function AdminOrdersSection() {
  const PAGE_SIZE = 25;
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    adminApi.listOrders({ page, limit: PAGE_SIZE, ...(status ? { status } : {}) })
      .then(({ data }) => {
        if (cancelled) return;
        setOrders(data.orders || []);
        setTotal(data.total || 0);
      })
      .catch(err => { if (!cancelled) setError(err.response?.data?.error || 'Could not load orders.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, status, retry]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">MARKETPLACE RECORDS</p><h2 className="mt-1 font-display text-2xl font-bold text-ink">Order activity</h2><p className="mt-1 text-sm text-ink-soft">Review orders in bounded pages. Filter by the current order state.</p></div>
        <label className="block text-xs font-semibold text-ink-soft">Status
          <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className="mt-1 min-h-10 rounded-xl border border-hairline bg-paper px-3 text-sm font-medium text-ink">
            {STATUSES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>

      {error && <div role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}<button type="button" onClick={() => setRetry(value => value + 1)} className="ml-2 font-semibold underline">Retry</button></div>}
      {loading ? <div className="space-y-3" role="status" aria-label="Loading orders">{[1,2,3].map(value => <div key={value} className="h-20 animate-pulse rounded-2xl bg-hairline"/>)}</div> : !orders.length ? (
        <div className="rounded-2xl border border-hairline bg-paper p-7 text-center"><SceneIllustration scene="orders" className="mx-auto h-28 w-40"/><p className="font-semibold text-ink">No orders in this view</p><p className="mt-1 text-sm text-ink-soft">Try another status filter.</p></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-hairline bg-paper">
          <div className="hidden grid-cols-[minmax(0,1fr)_160px_180px_130px] gap-3 border-b border-hairline bg-sand/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink-soft sm:grid"><span>Order</span><span>Restaurant</span><span>Created</span><span className="text-right">Total</span></div>
          {orders.map(order => (
            <article key={order.id} className="grid gap-2 border-b border-hairline px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_160px_180px_130px] sm:items-center sm:gap-3">
              <div className="min-w-0"><p className="font-mono text-[11px] text-ink-soft">#{order.id.slice(0,8)}</p><span className={`mt-1 inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${STATUS_STYLES[order.status] || 'bg-sand text-ink-soft'}`}>{order.status.replace(/_/g,' ')}</span></div>
              <span className="truncate text-sm text-ink-soft">Restaurant #{String(order.restaurant_id || '').slice(0,8) || '—'}</span>
              <span className="text-xs text-ink-soft">{new Date(order.created_at).toLocaleString()}</span>
              <span className="font-mono text-sm font-semibold text-ink sm:text-right">₦{Number(order.total_amount || 0).toLocaleString('en-NG')}</span>
            </article>
          ))}
        </div>
      )}
      {!loading && <PaginationControls page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage}/>}
    </section>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('Overview');

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9">
      <header className="overflow-hidden rounded-[26px] bg-ink px-5 py-6 text-white sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFC5AA]">DElIXIOUS CONTROL ROOM</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Marketplace HQ</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/75">Partner approvals, user access, order oversight and platform communications.</p></div>
          <div className="hidden sm:block"><SceneIllustration scene="success" className="h-28 w-40"/></div>
        </div>
      </header>

      <div className="mt-5 border-b border-hairline">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Administration sections">
          {TABS.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
            className={`inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${tab === item.id ? 'border-pepper text-pepper' : 'border-transparent text-ink-soft hover:text-ink'}`}>
            <Icon name={item.icon} size={17}/>{item.label}
          </button>)}
        </div>
      </div>

      <div className="mt-6">
        {tab === 'Overview' && <StatsSection/>}
        {tab === 'Restaurants' && <RestaurantsApprovalSection/>}
        {tab === 'Riders' && <RidersApprovalSection/>}
        {tab === 'Users' && <UsersSection/>}
        {tab === 'Orders' && <AdminOrdersSection/>}
        {tab === 'Broadcast' && <BroadcastSection/>}
      </div>
    </div>
  );
}
