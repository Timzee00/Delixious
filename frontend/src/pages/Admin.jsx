import { useEffect, useState } from 'react';
import { adminApi } from '../lib/adminApi.js';
import StatsSection from '../components/admin/StatsSection.jsx';
import RestaurantsApprovalSection from '../components/admin/RestaurantsApprovalSection.jsx';
import RidersApprovalSection from '../components/admin/RidersApprovalSection.jsx';
import UsersSection from '../components/admin/UsersSection.jsx';
import BroadcastSection from '../components/admin/BroadcastSection.jsx';
import PaginationControls from '../components/ui/PaginationControls.jsx';

const TABS = ['Overview', 'Restaurants', 'Riders', 'Users', 'Orders', 'Broadcast'];

function AdminOrdersSection() {
  const PAGE_SIZE = 25;
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    adminApi.listOrders({ page, limit: PAGE_SIZE })
      .then(({ data }) => {
        if (cancelled) return;
        setOrders(data.orders || []);
        setTotal(data.total || 0);
      })
      .catch(err => { if (!cancelled) setError(err.response?.data?.error || 'Could not load orders.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page]);

  if (error) return <div><p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p><button type="button" onClick={() => setPage(page)} className="mt-3 text-sm font-semibold text-pepper underline">Retry</button></div>;
  if (loading) return <p className="text-sm text-ink-soft">Loading marketplace orders…</p>;
  if (!orders.length) return <div className="rounded-xl border border-hairline bg-paper p-8 text-center text-sm text-ink-soft">No orders have been placed yet.</div>;

  return (
    <section>
      <div className="mb-4"><h2 className="font-display text-xl font-bold text-ink">Marketplace orders</h2><p className="mt-1 text-sm text-ink-soft">Newest orders first. Open a page to inspect a bounded batch of records.</p></div>
      <div className="space-y-3">
        {orders.map(order => (
          <article key={order.id} className="rounded-xl border border-hairline bg-paper p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-mono text-xs text-ink-soft">#{order.id.slice(0, 8)}</p><p className="mt-1 font-semibold capitalize text-ink">{order.status.replace(/_/g, ' ')}</p></div>
              <div className="text-right"><p className="font-mono text-sm font-semibold text-ink">₦{Number(order.total_amount || 0).toLocaleString()}</p><p className="mt-1 text-xs text-ink-soft">{new Date(order.created_at).toLocaleString()}</p></div>
            </div>
          </article>
        ))}
      </div>
      <PaginationControls page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage}/>
    </section>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('Overview');

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="rounded-2xl border border-hairline bg-paper p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-pepper">Control center</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Delixious Admin</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
              Review marketplace activity, approve partners, manage riders and users, and send platform notifications.
            </p>
          </div>
          <span className="w-fit rounded-full bg-jade-soft px-3 py-1.5 text-xs font-semibold text-jade">Admin access</span>
        </div>

        <div className="mt-6 overflow-x-auto border-b border-hairline">
          <div className="flex min-w-max gap-1" role="tablist" aria-label="Admin sections">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                  tab === t
                    ? 'border-pepper bg-pepper/5 text-pepper'
                    : 'border-transparent text-ink-soft hover:bg-sand hover:text-ink'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        {tab === 'Overview' && <StatsSection />}
        {tab === 'Restaurants' && <RestaurantsApprovalSection />}
        {tab === 'Riders' && <RidersApprovalSection />}
        {tab === 'Users' && <UsersSection />}
        {tab === 'Orders' && <AdminOrdersSection />}
        {tab === 'Broadcast' && <BroadcastSection />}
      </div>
    </div>
  );
}
