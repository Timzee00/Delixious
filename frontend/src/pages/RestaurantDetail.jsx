import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import MenuItemRow from '../components/MenuItemRow.jsx';
import FavoriteButton from '../components/FavoriteButton.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import SceneIllustration from '../components/ui/SceneIllustration.jsx';
import Icon from '../components/ui/Icon.jsx';
import { SearchField, Button } from '../components/ui/Primitives.jsx';

const PAGE_SIZE = 30;

export default function RestaurantDetail() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const { refreshCart } = useCart();
  const isMounted = useRef(true);
  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [menuPage, setMenuPage] = useState(1);
  const [menuTotal, setMenuTotal] = useState(0);
  const [menuQuery, setMenuQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuLoadingMore, setMenuLoadingMore] = useState(false);
  const [menuError, setMenuError] = useState('');
  const [menuMoreError, setMenuMoreError] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [itemStatus, setItemStatus] = useState({});
  const [conflict, setConflict] = useState(null);

  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(menuQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [menuQuery]);

  useEffect(() => {
    let cancelled = false;
    async function loadRestaurant() {
      setLoading(true);
      setLoadError('');
      try {
        const requests = [api.get(`/restaurants/${id}`)];
        if (isAuthenticated) requests.push(api.get('/favorites/restaurants'));
        const [restaurantRes, favoriteRes] = await Promise.all(requests);
        if (!cancelled) {
          setRestaurant(restaurantRes.data.restaurant);
          if (favoriteRes) setIsFavorite((favoriteRes.data.restaurant_ids || []).includes(id));
          else setIsFavorite(false);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.response?.data?.error || 'Could not load this restaurant.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadRestaurant();
    return () => { cancelled = true; };
  }, [id, isAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setMenuLoading(true);
    setMenuError('');
    setMenuMoreError('');
    setMenuPage(1);
    api.get(`/restaurants/${id}/menu`, {
      params: { page: 1, limit: PAGE_SIZE, ...(debouncedQuery ? { q: debouncedQuery } : {}) },
      signal: controller.signal,
    }).then(({ data }) => {
      if (cancelled) return;
      setMenuItems(data.menu_items || []);
      setMenuTotal(data.total || 0);
      setMenuPage(1);
    }).catch(err => {
      if (!cancelled && err.code !== 'ERR_CANCELED') setMenuError(err.response?.data?.error || 'Could not load this menu.');
    }).finally(() => {
      if (!cancelled) setMenuLoading(false);
    });
    return () => { cancelled = true; controller.abort(); };
  }, [id, debouncedQuery]);

  async function loadMoreMenu() {
    if (menuLoadingMore || menuLoading || menuItems.length >= menuTotal) return;
    setMenuLoadingMore(true);
    setMenuMoreError('');
    try {
      const { data } = await api.get(`/restaurants/${id}/menu`, {
        params: { page: menuPage + 1, limit: PAGE_SIZE, ...(debouncedQuery ? { q: debouncedQuery } : {}) },
      });
      setMenuItems(current => [...current, ...(data.menu_items || [])]);
      setMenuPage(menuPage + 1);
      setMenuTotal(data.total || menuTotal);
    } catch (err) {
      setMenuMoreError(err.response?.data?.error || 'Could not load more dishes. Please retry.');
    } finally {
      setMenuLoadingMore(false);
    }
  }

  const grouped = useMemo(() => menuItems.reduce((groups, item) => {
    const key = item.category || 'Other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {}), [menuItems]);

  async function toggleFavorite() {
    if (!isAuthenticated || favoriteBusy) return;
    setFavoriteBusy(true);
    setActionError('');
    try {
      if (isFavorite) await api.delete(`/favorites/restaurants/${id}`);
      else await api.post(`/favorites/restaurants/${id}`);
      setIsFavorite(value => !value);
    } catch (err) {
      setActionError(err.response?.data?.error || 'Could not update your favorite.');
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function handleAdd(item, replace = false) {
    if (!isAuthenticated) { setActionError('Sign in to add dishes to your cart.'); return; }
    setActionError('');
    setItemStatus(prev => ({ ...prev, [item.id]: 'adding' }));
    try {
      await api.post('/cart/items', { menu_item_id: item.id, quantity: 1, replace });
      await refreshCart();
      setConflict(null);
      if (isMounted.current) {
        setItemStatus(prev => ({ ...prev, [item.id]: 'added' }));
        setTimeout(() => { if (isMounted.current) setItemStatus(prev => ({ ...prev, [item.id]: undefined })); }, 1200);
      }
    } catch (err) {
      if (err.response?.status === 409) setConflict({ message: err.response.data.error, item });
      else setActionError(err.response?.data?.error || 'Could not add item to cart.');
      if (isMounted.current) setItemStatus(prev => ({ ...prev, [item.id]: undefined }));
    }
  }

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-16 text-center font-mono text-sm text-ink-soft">Loading restaurant…</div>;
  if (loadError && !restaurant) return <div className="mx-auto max-w-3xl px-4 py-16 text-center"><SceneIllustration scene="unavailable" className="mx-auto h-28 w-40"/><p className="text-ink-soft">{loadError}</p><Link to="/restaurants" className="mt-4 inline-block text-sm font-semibold text-pepper hover:underline">Back to restaurants</Link></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-9">
      <Link to="/restaurants" className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-ink-soft hover:text-pepper"><Icon name="arrow-left" size={16}/> All restaurants</Link>
      <section className="mt-3 overflow-hidden rounded-[28px] border border-hairline bg-paper shadow-sm">
        <div className="relative h-40 overflow-hidden bg-gradient-to-br from-[#FBE0D2] to-[#F2B98F] sm:h-56">
          {restaurant.cover_image_url ? <img src={restaurant.cover_image_url} alt="" className="h-full w-full object-cover" loading="eager"/> : <div className="absolute inset-0 flex items-center justify-center"><SceneIllustration scene="kitchen" className="h-36 w-48 opacity-90"/></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent"/>
          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-3 sm:bottom-5 sm:left-7 sm:right-7">
            <div className="flex min-w-0 items-center gap-3">
              {restaurant.logo_url && <img src={restaurant.logo_url} alt="" className="h-14 w-14 rounded-2xl border-2 border-white object-cover shadow-lg sm:h-16 sm:w-16"/>}
              <div className="min-w-0"><h1 className="truncate font-display text-2xl font-bold text-white drop-shadow-sm sm:text-3xl">{restaurant.name}</h1><p className="mt-0.5 truncate text-xs font-medium text-white/90 sm:text-sm">{restaurant.cuisine_type || 'Restaurant'}</p></div>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${restaurant.is_open ? 'bg-jade text-white' : 'bg-white/90 text-ink'}`}>{restaurant.is_open ? 'Open now' : 'Closed'}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:px-7 sm:py-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-soft">
            {restaurant.rating_count > 0 && <span className="inline-flex items-center gap-1.5 font-semibold text-ink"><Icon name="star" size={16} className="fill-gold text-gold"/>{Number(restaurant.rating_avg).toFixed(1)} <span className="font-normal text-ink-soft">({restaurant.rating_count.toLocaleString()} reviews)</span></span>}
            {restaurant.address && <span className="inline-flex items-center gap-1.5"><Icon name="map-pin" size={16}/>{restaurant.address}</span>}
          </div>
          <FavoriteButton active={isFavorite} onClick={toggleFavorite} disabled={!isAuthenticated || favoriteBusy}/>
        </div>
        {restaurant.description && <p className="border-t border-hairline px-4 py-4 text-sm leading-6 text-ink-soft sm:px-7">{restaurant.description}</p>}
      </section>

      {actionError && <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{actionError}</p>}
      {!restaurant.is_open && <p role="status" className="mt-4 rounded-xl border border-hairline bg-sand px-4 py-3 text-sm text-ink-soft">This kitchen is closed. You can browse the menu, but ordering is paused.</p>}
      {!isAuthenticated && <p className="mt-4 text-xs text-ink-soft">Sign in to save favorites and add dishes to your cart.</p>}

      <section className="mt-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">FROM THE KITCHEN</p><h2 className="mt-1 font-display text-2xl font-bold text-ink">The menu</h2></div>
          <div className="w-full sm:w-72"><SearchField id="restaurant-menu-search" label="Search this menu" value={menuQuery} onChange={setMenuQuery} placeholder="Find a dish…"/></div>
        </div>
        {menuError && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{menuError}</p>}
        {menuLoading ? <div className="space-y-3">{[1,2,3].map(item => <div key={item} className="h-24 animate-pulse rounded-2xl bg-hairline"/>)}</div> : !menuItems.length ? (
          <div className="rounded-2xl border border-hairline bg-paper p-4 sm:p-7"><SceneIllustration scene="kitchen" className="mx-auto h-32 w-44"/><h3 className="mt-2 text-center font-display text-lg font-bold text-ink">{debouncedQuery ? 'No dishes found' : 'Menu coming soon'}</h3><p className="mt-1 text-center text-sm text-ink-soft">{debouncedQuery ? 'Try another dish name.' : 'This restaurant has not listed any available dishes yet.'}</p></div>
        ) : (
          <>
            <div className="space-y-8">
              {Object.entries(grouped).map(([categoryName, items]) => <section key={categoryName}><h3 className="font-display text-lg font-bold text-ink">{categoryName}</h3><div className="mt-3 space-y-3">{items.map(item => <MenuItemRow key={item.id} item={item} status={itemStatus[item.id]} onAdd={() => handleAdd(item)} disabled={!restaurant.is_open}/>)}</div></section>)}
            </div>
            {menuItems.length < menuTotal && <div className="mt-7 flex flex-col items-center gap-2"><p className="text-xs text-ink-soft">Showing {menuItems.length.toLocaleString()} of {menuTotal.toLocaleString()} dishes</p>{menuMoreError && <p role="alert" className="text-sm text-danger">{menuMoreError}</p>}<Button variant="secondary" busy={menuLoadingMore} onClick={loadMoreMenu}>{menuMoreError ? 'Retry loading menu' : 'Load more dishes'}</Button></div>}
          </>
        )}
      </section>

      {conflict && <ConfirmModal title="Switch restaurants?" message={conflict.message} confirmLabel="Replace cart" onCancel={() => setConflict(null)} onConfirm={() => handleAdd(conflict.item, true)}/>}
    </div>
  );
}
