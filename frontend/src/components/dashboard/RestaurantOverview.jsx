import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api.js';
import Icon from '../ui/Icon.jsx';
import SceneIllustration from '../ui/SceneIllustration.jsx';
import { Button, InlineStatus } from '../ui/Primitives.jsx';

const ACTIVE_STATUSES = 'pending,confirmed,preparing,out_for_delivery';

function Stat({ icon, label, value, detail, tone = 'neutral' }) {
  const styles = {
    neutral: 'bg-sand text-ink',
    success: 'bg-jade-soft text-jade',
    warning: 'bg-[#FFF2D8] text-[#8A5A00]',
  };
  return (
    <div className="rounded-2xl border border-hairline bg-paper p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-ink-soft">{label}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${styles[tone]}`}><Icon name={icon} size={18}/></span>
      </div>
      <p className="mt-4 font-display text-3xl font-bold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-soft">{detail}</p>
    </div>
  );
}

export default function RestaurantOverview({ restaurant, onOpenOrders, onOpenMenu }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ordersRes, menuRes, availableRes] = await Promise.all([
        api.get(`/restaurants/${restaurant.id}/orders`, { params: { page: 1, limit: 6, statuses: ACTIVE_STATUSES, paid_only: 'true' } }),
        api.get(`/restaurants/${restaurant.id}/menu-management`, { params: { page: 1, limit: 1, availability: 'all' } }),
        api.get(`/restaurants/${restaurant.id}/menu-management`, { params: { page: 1, limit: 1, availability: 'available' } }),
      ]);
      setSummary({
        activeOrders: ordersRes.data.total || 0,
        recentOrders: ordersRes.data.orders || [],
        menuItems: menuRes.data.total || 0,
        availableItems: availableRes.data.total || 0,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load your restaurant overview.');
    } finally {
      setLoading(false);
    }
  }, [restaurant.id]);

  useEffect(() => { load(); }, [load, retry]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">YOUR KITCHEN</p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">Today at {restaurant.name}</h2>
          <p className="mt-1 text-sm text-ink-soft">A live snapshot from your current orders and menu records.</p>
        </div>
        <div className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-xs font-bold ${restaurant.is_open ? 'bg-jade-soft text-jade' : 'bg-sand text-ink-soft'}`}>
          <span className={`h-2 w-2 rounded-full ${restaurant.is_open ? 'bg-jade' : 'bg-ink-soft'}`}/>{restaurant.is_open ? 'Accepting orders' : 'Not accepting orders'}
        </div>
      </div>

      {restaurant.approval_status !== 'approved' && <InlineStatus tone="warning">Your restaurant is {restaurant.approval_status || 'awaiting review'}. Customer ordering becomes available after approval and payout setup.</InlineStatus>}
      {error && <div role="alert" className="rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm text-danger">{error}<button type="button" onClick={() => setRetry(v => v + 1)} className="ml-2 font-semibold underline">Retry</button></div>}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1,2,3,4].map(n => <div key={n} className="h-32 animate-pulse rounded-2xl bg-hairline"/>)}
        </div>
      ) : summary && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon="clipboard-list" label="Active orders" value={summary.activeOrders.toLocaleString()} detail="Awaiting preparation or delivery" tone={summary.activeOrders ? 'warning' : 'neutral'}/>
            <Stat icon="utensils" label="Menu dishes" value={summary.menuItems.toLocaleString()} detail="All listed menu items"/>
            <Stat icon="circle-check" label="Available dishes" value={summary.availableItems.toLocaleString()} detail="Currently marked available" tone="success"/>
            <Stat icon="store-front" label="Storefront" value={restaurant.is_open ? 'Open' : 'Closed'} detail={restaurant.approval_status === 'approved' ? 'Marketplace approval status' : 'Approval required'} tone={restaurant.is_open ? 'success' : 'neutral'}/>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)]">
            <section className="overflow-hidden rounded-2xl border border-hairline bg-paper">
              <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-4 sm:px-5">
                <div><h3 className="font-display text-lg font-bold text-ink">Order queue</h3><p className="mt-0.5 text-xs text-ink-soft">Newest active orders</p></div>
                <button type="button" onClick={onOpenOrders} className="inline-flex min-h-9 items-center gap-1 text-xs font-bold text-pepper hover:underline">Open queue <Icon name="arrow-right" size={15}/></button>
              </div>
              {summary.recentOrders.length ? <div className="divide-y divide-hairline">
                {summary.recentOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0"><p className="font-mono text-[11px] text-ink-soft">#{order.id.slice(0,8)}</p><p className="mt-1 truncate text-sm font-semibold capitalize text-ink">{order.status.replace(/_/g,' ')}</p><p className="mt-0.5 text-xs text-ink-soft">{new Date(order.created_at).toLocaleString()}</p></div>
                    <span className="shrink-0 font-mono text-sm font-semibold text-ink">₦{Number(order.total_amount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div> : <div className="px-4 py-6 text-center"><SceneIllustration scene="orders" className="mx-auto h-24 w-32"/><p className="text-sm font-semibold text-ink">No active orders</p><p className="mt-1 text-xs text-ink-soft">New paid orders will appear here.</p></div>}
            </section>

            <section className="flex flex-col justify-between rounded-2xl border border-hairline bg-paper p-5">
              <div>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-pepper/10 text-pepper"><Icon name="chef-hat" size={22}/></span>
                <h3 className="mt-4 font-display text-lg font-bold text-ink">Keep your menu fresh</h3>
                <p className="mt-2 text-sm leading-6 text-ink-soft">Update dish photos, prices and availability so customers see accurate choices.</p>
              </div>
              <Button variant="secondary" className="mt-5 w-full" onClick={onOpenMenu}>Manage menu <Icon name="arrow-right" size={16}/></Button>
            </section>
          </div>
        </>
      )}
    </section>
  );
}
