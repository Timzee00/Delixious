import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/adminApi.js';
import PaginationControls from '../ui/PaginationControls.jsx';

const PAGE_SIZE = 20;

export default function RidersApprovalSection() {
  const [riders, setRiders] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    adminApi.listRiders({ page, limit: PAGE_SIZE })
      .then(({ data }) => {
        if (cancelled) return;
        setRiders(data.riders || []);
        setTotal(data.total || 0);
      })
      .catch(err => { if (!cancelled) setError(err.response?.data?.error || 'Could not load riders.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page]);

  async function setApproval(id, status) {
    setBusyId(id);
    setError('');
    try {
      await adminApi.setRiderApproval(id, status);
      setRiders(current => current.map(r => r.id === id ? { ...r, rider_approval_status: status } : r));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update rider.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div><h2 className="font-display text-xl font-bold text-ink">Rider applications</h2><p className="mt-1 text-sm text-ink-soft">Review approved and pending delivery partners.</p></div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {loading ? <p className="mt-6 text-sm text-ink-soft">Loading riders…</p> : !riders.length ? (
        <div className="mt-6 rounded-xl border border-hairline bg-paper p-8 text-center text-sm text-ink-soft">No riders found.</div>
      ) : (
        <div className="mt-5 space-y-3">
          {riders.map(r => (
            <article key={r.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-hairline bg-paper p-4">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{r.full_name || 'Rider profile'}</p>
                <p className="mt-1 text-sm text-ink-soft">{r.phone || r.email || 'No contact supplied'}</p>
                <p className="mt-1 text-xs capitalize text-ink-soft">{r.rider_approval_status || 'pending'} · {r.rider_rating_count ? `Rating ${r.rider_rating_avg} (${r.rider_rating_count})` : 'No ratings yet'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {r.rider_approval_status !== 'approved' && <button type="button" disabled={busyId === r.id} onClick={() => setApproval(r.id, 'approved')} className="min-h-10 rounded-lg bg-jade px-3 text-sm font-semibold text-white disabled:opacity-50">{busyId === r.id ? 'Saving…' : 'Approve'}</button>}
                {r.rider_approval_status !== 'rejected' && <button type="button" disabled={busyId === r.id} onClick={() => setApproval(r.id, 'rejected')} className="min-h-10 rounded-lg border border-hairline px-3 text-sm font-semibold text-danger disabled:opacity-50">Reject</button>}
              </div>
            </article>
          ))}
        </div>
      )}
      {!loading && <PaginationControls page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage}/>}
    </section>
  );
}
