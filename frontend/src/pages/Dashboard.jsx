import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import RestaurantProfileSection from '../components/dashboard/RestaurantProfileSection.jsx';
import MenuManagementSection from '../components/dashboard/MenuManagementSection.jsx';
import OrdersQueueSection from '../components/dashboard/OrdersQueueSection.jsx';
import RestaurantOverview from '../components/dashboard/RestaurantOverview.jsx';
import PaginationControls from '../components/ui/PaginationControls.jsx';
import Icon from '../components/ui/Icon.jsx';
import SceneIllustration from '../components/ui/SceneIllustration.jsx';
import { Button } from '../components/ui/Primitives.jsx';

const PAGE_SIZE = 20;
const TABS = [
  { id: 'Overview', icon: 'chart-no-axes-column', label: 'Overview' },
  { id: 'Orders', icon: 'clipboard-list', label: 'Orders' },
  { id: 'Menu', icon: 'utensils', label: 'Menu' },
  { id: 'Profile', icon: 'settings', label: 'Settings' },
];

export default function Dashboard() {
  const [restaurants, setRestaurants] = useState([]);
  const [totalRestaurants, setTotalRestaurants] = useState(0);
  const [restaurantPage, setRestaurantPage] = useState(1);
  const [activeId, setActiveId] = useState('');
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/restaurants/mine', { params: { page: restaurantPage, limit: PAGE_SIZE } });
      setRestaurants(data.restaurants || []);
      setTotalRestaurants(data.total || 0);
      setActiveId(current => (data.restaurants || []).some(item => item.id === current) ? current : data.restaurants?.[0]?.id || '');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load your restaurants.');
    } finally {
      setLoading(false);
    }
  }, [restaurantPage, retry]);

  useEffect(() => { load(); }, [load]);

  function handleRestaurantUpdated(updated) {
    setRestaurants(current => current.map(item => item.id === updated.id ? updated : item));
  }

  function handleRestaurantCreated(created) {
    setRestaurantPage(1);
    setRestaurants([created]);
    setActiveId(created.id);
    setTotalRestaurants(value => value + 1);
    setTab('Overview');
  }

  const activeRestaurant = restaurants.find(item => item.id === activeId) || null;

  if (loading && !restaurants.length) {
    return <div className="mx-auto max-w-7xl px-4 py-16 text-center"><SceneIllustration scene="kitchen" className="mx-auto h-28 w-40"/><p role="status" className="mt-2 text-sm text-ink-soft">Loading your workspace…</p></div>;
  }

  if (error && !restaurants.length) {
    return <div className="mx-auto max-w-xl px-4 py-16 text-center"><SceneIllustration scene="unavailable" className="mx-auto h-28 w-40"/><h1 className="font-display text-xl font-bold text-ink">Workspace unavailable</h1><p role="alert" className="mt-2 text-sm text-ink-soft">{error}</p><Button className="mt-5" variant="secondary" onClick={() => setRetry(value => value + 1)}>Try again</Button></div>;
  }

  if (!restaurants.length && !loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-5 text-center"><SceneIllustration scene="kitchen" className="mx-auto h-36 w-48"/><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">RESTAURANT PARTNER</p><h1 className="mt-2 font-display text-3xl font-bold text-ink">Set up your kitchen</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">Create your restaurant profile, add your menu and complete payout setup before accepting paid orders.</p></div>
        {error && <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <RestaurantProfileSection restaurant={null} onCreated={handleRestaurantCreated}/>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">PARTNER WORKSPACE</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Your kitchen</h1>
          <p className="mt-1 text-sm text-ink-soft">Manage service, orders and your menu in one place.</p>
        </div>
        <Link to="/wallet" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-hairline bg-paper px-4 text-sm font-semibold text-ink hover:border-pepper hover:text-pepper"><Icon name="wallet" size={17}/> Wallet</Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-paper p-3 sm:p-4">
        <div className="min-w-0 flex-1">
          <label htmlFor="restaurant-workspace-select" className="block text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Selected restaurant</label>
          <select id="restaurant-workspace-select" value={activeId} onChange={event => setActiveId(event.target.value)} className="mt-1 min-h-10 w-full max-w-lg rounded-lg border border-hairline bg-paper px-3 text-sm font-semibold text-ink">
            {restaurants.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        {activeRestaurant && <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${activeRestaurant.approval_status === 'approved' ? 'bg-jade-soft text-jade' : 'bg-sand text-ink-soft'}`}><span className={`h-2 w-2 rounded-full ${activeRestaurant.approval_status === 'approved' ? 'bg-jade' : 'bg-gold'}`}/>{activeRestaurant.approval_status === 'approved' ? 'Approved partner' : `Approval: ${activeRestaurant.approval_status || 'pending'}`}</div>}
      </div>
      {totalRestaurants > PAGE_SIZE && <PaginationControls page={restaurantPage} total={totalRestaurants} pageSize={PAGE_SIZE} onPageChange={setRestaurantPage} loading={loading}/>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}<button type="button" onClick={() => setRetry(value => value + 1)} className="ml-2 font-semibold underline">Retry</button></p>}

      <div className="mt-7 border-b border-hairline">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Restaurant workspace sections">
          {TABS.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${tab === item.id ? 'border-pepper text-pepper' : 'border-transparent text-ink-soft hover:text-ink'}`}>
            <Icon name={item.icon} size={17}/>{item.label}
          </button>)}
        </div>
      </div>

      <div className="mt-6">
        {activeRestaurant && tab === 'Overview' && <RestaurantOverview restaurant={activeRestaurant} onOpenOrders={() => setTab('Orders')} onOpenMenu={() => setTab('Menu')}/>}
        {activeRestaurant && tab === 'Orders' && <OrdersQueueSection restaurant={activeRestaurant}/>}
        {activeRestaurant && tab === 'Menu' && <MenuManagementSection restaurant={activeRestaurant}/>}
        {activeRestaurant && tab === 'Profile' && <RestaurantProfileSection restaurant={activeRestaurant} onUpdated={handleRestaurantUpdated}/>}
      </div>
    </div>
  );
}
