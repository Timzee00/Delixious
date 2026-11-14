import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import { formatNaira } from '../lib/format.js';
import { EmptyState, ErrorState } from '../components/StateViews.jsx';
import SceneIllustration from '../components/ui/SceneIllustration.jsx';

const PAGE_SIZE = 15;

const STATUS_STYLES = {
  pending: 'bg-gold text-white',
  confirmed: 'bg-gold text-white',
  preparing: 'bg-gold text-white',
  out_for_delivery: 'bg-pepper text-white',
  delivered: 'bg-jade text-white',
  cancelled: 'bg-ink-soft text-white',
};

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const isFirstPage = page === 1;
    setError('');
    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);

    api
      .get('/orders', { params: { page, limit: PAGE_SIZE } })
      .then(({ data }) => {
        if (!cancelled) {
          setOrders((prev) => (isFirstPage ? data.orders : [...prev, ...data.orders]));
          setTotal(data.total);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load your orders.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, retry]);

  const hasMore = orders.length < total;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex items-end justify-between gap-4"><div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">YOUR FOOD JOURNEY</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Your orders</h1><p className="mt-1 text-sm text-ink-soft">Follow every order from kitchen to doorstep.</p></div><div className="hidden sm:block"><SceneIllustration scene="delivery" className="h-24 w-32" /></div></div>

      <div className="mt-6">
        {loading ? (
          <p className="text-center font-mono text-sm text-ink-soft">Loading...</p>
        ) : error ? (
          <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />
        ) : orders.length === 0 ? (
          <EmptyState illustration="orders" title="Your order history starts here" message="Your completed and current orders will appear here." />
        ) : (
          <>
            {error && <p role="alert" className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error} <button type="button" onClick={() => setRetry(value => value + 1)} className="ml-1 font-semibold underline">Retry this page</button></p>}
            <div className="space-y-3">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="ticket block p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-display text-sm font-bold text-ink">{order.restaurants?.name}</h4>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${
                        STATUS_STYLES[order.status] || 'bg-ink-soft text-white'
                      }`}
                    >
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm text-ink-soft">
                    <span>{new Date(order.created_at).toLocaleDateString()}</span>
                    <span className="font-mono font-semibold text-ink">{formatNaira(order.total_amount)}</span>
                  </div>
                </Link>
              ))}
            </div>
            {hasMore && (
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loadingMore}
                className="mt-6 w-full rounded-lg border border-hairline py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-pepper hover:text-pepper disabled:opacity-60"
              >
                {loadingMore ? 'Loading...' : 'Load more orders'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
