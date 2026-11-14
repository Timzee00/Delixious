import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/adminApi.js';
import PaginationControls from '../ui/PaginationControls.jsx';

const PAGE_SIZE = 20;
const FILTERS = ['pending', 'approved', 'rejected', ''];

export default function RestaurantsApprovalSection() {
  const [restaurants, setRestaurants] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    adminApi.listRestaurants({ status: filter || undefined, page, limit: PAGE_SIZE })
      .then(({ data }) => {
        if (cancelled) return;
        setRestaurants(data.restaurants || []);
        setTotal(data.total || 0);
      })
      .catch(err => { if (!cancelled) setError(err.response?.data?.error || 'Could not load restaurants.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter, page]);

  async function setApproval(id, status) {
    setBusyId(id);
    setError('');
    try {
      await adminApi.setRestaurantApproval(id, status);
      const remaining = restaurants.filter(item => item.id !== id);
      if (!remaining.length && page > 1) setPage(current => current - 1);
      else {
        setRestaurants(remaining);
        setTotal(value => Math.max(0, value - 1));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update restaurant.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-xl font-bold text-ink">Restaurant applications</h2><p className="mt-1 text-sm text-ink-soft">Review partner status in manageable batches.</p></div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(status => <button key={status || 'all'} type="button" onClick={() => { setFilter(status); setPage(1); }}
            aria-pressed={filter === status}
            className={`min-h-9 rounded-lg px-3 text-xs font-semibold capitalize ${filter === status ? 'bg-pepper text-white' : 'bg-sand text-ink-soft hover:text-ink'}`}>
            {status || 'All'}
          </button>)}
        </div>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {loading ? <p className="mt-6 text-sm text-ink-soft">Loading restaurants…</p> : !restaurants.length ? (
        <div className="mt-6 rounded-xl border border-hairline bg-paper p-8 text-center text-sm text-ink-soft">No restaurants in this view.</div>
      ) : (
        <div className="mt-5 space-y-3">
          {restaurants.map(r => (
            <article key={r.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-hairline bg-paper p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{r.name}</p>
                <p className="mt-1 text-sm text-ink-soft">{r.address || 'Address not supplied'}</p>
                <p className="mt-1 text-xs capitalize text-ink-soft">{r.cuisine_type || 'Cuisine not set'} · {r.approval_status}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {r.approval_status !== 'approved' && <button type="button" disabled={busyId === r.id} onClick={() => setApproval(r.id, 'approved')} className="min-h-10 rounded-lg bg-jade px-3 text-sm font-semibold text-white disabled:opacity-50">{busyId === r.id ? 'Saving…' : 'Approve'}</button>}
                {r.approval_status !== 'rejected' && <button type="button" disabled={busyId === r.id} onClick={() => setApproval(r.id, 'rejected')} className="min-h-10 rounded-lg border border-hairline px-3 text-sm font-semibold text-danger disabled:opacity-50">Reject</button>}
              </div>
            </article>
          ))}
        </div>
      )}
      {!loading && <PaginationControls page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} loading={loading}/>}
    </section>
  );
}
