import { useEffect, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import api from '../lib/api.js';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { EmptyState, ErrorState } from '../components/StateViews.jsx';
import Icon from '../components/ui/Icon.jsx';
import PaginationControls from '../components/ui/PaginationControls.jsx';

const PAGE_SIZE = 20;
const VIRTUALIZE_THRESHOLD = 50;
const ROW_HEIGHT = 88;

const TYPE_LABELS = {
  order_update: 'Order update',
  payment: 'Payment',
  promo: 'Promo',
  general: 'Notification',
  broadcast: 'Platform notice',
};
const TYPE_ICONS = {
  order_update: 'receipt-text',
  payment: 'credit-card',
  promo: 'sparkles',
  general: 'bell',
  broadcast: 'bell',
};

export default function Notifications() {
  const { refreshUnreadCount, unreadCount } = useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    load(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]);

  async function load(pageToLoad, append) {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/notifications', { params: { page: pageToLoad, limit: PAGE_SIZE } });
      const rows = data.notifications || [];
      setNotifications(current => append ? [...current, ...rows] : rows);
      setTotal(data.total || 0);
      setPage(pageToLoad);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load notifications.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function markRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(current => current.map(item => item.id === id ? { ...item, is_read: true } : item));
      refreshUnreadCount();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not mark this notification as read.');
    }
  }

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(current => current.map(item => ({ ...item, is_read: true })));
      refreshUnreadCount();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not mark notifications as read.');
    }
  }

  async function remove(id) {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(current => current.filter(item => item.id !== id));
      setTotal(value => Math.max(0, value - 1));
      refreshUnreadCount();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete this notification.');
    }
  }

  const hasMore = notifications.length < total;
  const rowProps = { onRead: markRead, onRemove: remove };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-9">
      <header className="flex items-end justify-between gap-4">
        <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">YOUR UPDATES</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Notifications</h1><p className="mt-1 text-sm text-ink-soft">Order progress and account activity.</p></div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-pepper/10 text-pepper"><Icon name="bell" size={23}/></div>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-soft">{unreadCount.toLocaleString()} unread</p>
        {unreadCount > 0 && <button type="button" onClick={markAllRead} className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-pepper hover:underline"><Icon name="check" size={15}/> Mark all as read</button>}
      </div>

      <div className="mt-4">
        {error && notifications.length > 0 && <div role="alert" className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}<button type="button" onClick={() => setRetry(value => value + 1)} className="ml-2 font-semibold underline">Retry first page</button></div>}
        {loading ? (
          <div className="space-y-3" role="status" aria-label="Loading notifications">{[1,2,3].map(value => <div key={value} className="h-20 animate-pulse rounded-2xl bg-hairline"/>)}</div>
        ) : error && notifications.length === 0 ? (
          <ErrorState message={error} onRetry={() => setRetry(value => value + 1)}/>
        ) : notifications.length === 0 ? (
          <EmptyState illustration="notifications" title="You are all caught up" message="Order progress and account updates will appear here."/>
        ) : notifications.length > VIRTUALIZE_THRESHOLD ? (
          <List height={Math.min(640, notifications.length * ROW_HEIGHT)} itemCount={notifications.length} itemSize={ROW_HEIGHT} width="100%">
            {({ index, style }) => <div style={style}><NotificationRow notification={notifications[index]} compact {...rowProps}/></div>}
          </List>
        ) : (
          <div className="space-y-3">{notifications.map(item => <NotificationRow key={item.id} notification={item} {...rowProps}/>)}</div>
        )}

        {hasMore && !loading && notifications.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-center text-xs text-ink-soft">Showing {notifications.length.toLocaleString()} of {total.toLocaleString()}</p>
            {error && <p role="alert" className="mb-2 text-center text-sm text-danger">{error}</p>}
            <button type="button" onClick={() => load(page + 1, true)} disabled={loadingMore} className="min-h-11 w-full rounded-xl border border-hairline bg-paper text-sm font-semibold text-ink hover:border-pepper hover:text-pepper disabled:opacity-60">
              {loadingMore ? 'Loading…' : error ? 'Retry loading more' : 'Load more notifications'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationRow({ notification: item, onRead, onRemove, compact = false }) {
  return (
    <article className={`ticket flex min-h-[76px] items-start gap-3 p-3 sm:p-4 ${compact ? 'mb-3' : ''} ${!item.is_read ? 'border-pepper/25 bg-pepper/[0.025]' : ''}`}>
      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.is_read ? 'bg-sand text-ink-soft' : 'bg-pepper/10 text-pepper'}`}>
        <Icon name={TYPE_ICONS[item.type] || 'bell'} size={17}/>
      </span>
      <button type="button" disabled={item.is_read} onClick={() => onRead(item.id)} aria-label={item.is_read ? item.title : `Mark ${item.title} as read`}
        className="min-w-0 flex-1 text-left disabled:cursor-default">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{TYPE_LABELS[item.type] || 'Notification'}</span>
          <span className="shrink-0 text-[11px] text-ink-soft/70">{new Date(item.created_at).toLocaleDateString()}</span>
        </span>
        <span className="mt-0.5 block truncate font-display text-sm font-bold text-ink">{item.title}</span>
        {item.body && <span className={`mt-1 block text-sm leading-5 text-ink-soft ${compact ? 'truncate' : ''}`}>{item.body}</span>}
      </button>
      <button type="button" onClick={() => onRemove(item.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-danger/10 hover:text-danger" aria-label={`Delete notification: ${item.title}`}>
        <Icon name="x" size={16}/>
      </button>
    </article>
  );
}
