import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../lib/api.js';

const PAGE_SIZE = 20;

function formatMoney(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

export default function EarningsSection() {
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (nextPage = 1, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/delivery/my-deliveries/history', {
        params: { page: nextPage, limit: PAGE_SIZE },
      });
      setHistory(current => append ? [...current, ...(data.deliveries || [])] : (data.deliveries || []));
      setTotal(data.total || 0);
      setPage(nextPage);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load earnings history.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const pageTotal = useMemo(() => history.reduce((sum, item) => sum + Number(item.orders?.rider_payout_amount || 0), 0), [history]);
  const pagePaid = useMemo(() => history.filter((item) => item.orders?.rider_payout_status === 'paid').reduce((sum, item) => sum + Number(item.orders?.rider_payout_amount || 0), 0), [history]);

  if (loading) return <p className="text-sm text-ink-soft">Loading earnings...</p>;

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-ink">Earnings history</h2><p className="mt-1 text-sm text-ink-soft">Completed delivery payouts, newest first.</p></div>
        <button type="button" onClick={() => load(1)} className="rounded-lg border border-hairline px-3 py-2 text-sm font-medium text-ink hover:bg-sand">Refresh</button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-hairline bg-white p-5 shadow-sm"><p className="text-sm text-ink-soft">Payout value on this page</p><p className="mt-2 text-2xl font-bold text-ink">{formatMoney(pageTotal)}</p></div>
        <div className="rounded-xl border border-hairline bg-white p-5 shadow-sm"><p className="text-sm text-ink-soft">Marked paid on this page</p><p className="mt-2 text-2xl font-bold text-pepper">{formatMoney(pagePaid)}</p></div>
      </div>
      {!history.length && !error ? <div className="mt-6 rounded-xl border border-hairline p-6 text-center text-sm text-ink-soft">No completed deliveries yet.</div> : (
        <>
          <div className="mt-6 overflow-hidden rounded-xl border border-hairline bg-white">
            <div className="hidden grid-cols-[1fr_1fr_auto] gap-4 border-b border-hairline bg-sand px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft sm:grid"><span>Order</span><span>Restaurant</span><span>Payout</span></div>
            {history.map((item) => <div key={item.order_id} className="grid gap-2 border-b border-hairline px-4 py-4 last:border-b-0 sm:grid-cols-[1fr_1fr_auto] sm:items-center"><span className="text-sm font-medium text-ink">#{String(item.order_id).slice(0, 8)}</span><span className="text-sm text-ink-soft">{item.orders?.restaurants?.name || 'Restaurant'}</span><span className="text-sm font-semibold text-ink">{formatMoney(item.orders?.rider_payout_amount)}</span></div>)}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
            <p className="text-xs text-ink-soft">Showing {history.length.toLocaleString()} of {total.toLocaleString()} completed deliveries</p>
            {history.length < total && <button type="button" disabled={loadingMore} onClick={() => load(page + 1, true)} className="min-h-10 rounded-lg border border-hairline px-4 text-sm font-semibold text-ink hover:border-pepper disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load more'}</button>}
          </div>
        </>
      )}
    </section>
  );
}
