import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import FoodCard from '../components/FoodCard.jsx';
import RestaurantCard from '../components/RestaurantCard.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { GridSkeleton, EmptyState, ErrorState } from '../components/StateViews.jsx';
import { SearchField } from '../components/ui/Primitives.jsx';
import Icon from '../components/ui/Icon.jsx';
import { formatNaira } from '../lib/format.js';

const CUISINES = ['All', 'Nigerian', 'Continental', 'Chinese', 'Fast Food', 'Grills', 'Seafood', 'Pastries'];
const CATEGORIES = [
  { name: 'Rice', search: 'rice', pattern: /rice|jollof/i },
  { name: 'Shawarma', search: 'shawarma', pattern: /shawarma|wrap/i },
  { name: 'Swallow', search: 'swallow', pattern: /amala|eba|fufu|pounded|swallow|semo/i },
  { name: 'Grills', search: 'grill', pattern: /grill|asun|suya|barbecue/i },
];

const ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'preparing', 'out_for_delivery']);

function SectionTitle({ eyebrow, title, action, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.17em] text-pepper">{eyebrow}</p>}
        <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h2>
        {children}
      </div>
      {action}
    </div>
  );
}

function CategoryCircle({ category, food, active, onChoose }) {
  return (
    <button type="button" onClick={() => onChoose(category.search)}
      aria-pressed={active}
      className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl px-1 py-2 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pepper">
      <span className={'flex aspect-square w-full max-w-[112px] items-center justify-center overflow-hidden rounded-full border-2 bg-paper shadow-sm transition-colors ' + (active ? 'border-pepper' : 'border-hairline group-hover:border-pepper/60')}>
        {food?.image_url ? (
          <img src={food.image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#FFE9CF] to-[#F5C4A3] text-pepper">
            <Icon name="bag" size={30} />
          </span>
        )}
      </span>
      <span className="text-xs font-semibold text-ink sm:text-sm">{category.name}</span>
    </button>
  );
}

export default function Home({ explore = false }) {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { refreshCart, itemCount, cart, cartError } = useCart();
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [cuisine, setCuisine] = useState('All');
  const [openOnly, setOpenOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [foodRetry, setFoodRetry] = useState(0);
  const [restaurantRetry, setRestaurantRetry] = useState(0);
  const [foods, setFoods] = useState([]);
  const [foodPage, setFoodPage] = useState(1);
  const [foodTotal, setFoodTotal] = useState(0);
  const [foodLoadingMore, setFoodLoadingMore] = useState(false);
  const [foodMoreError, setFoodMoreError] = useState('');
  const moreFoodsController = useRef(null);
  const [restaurants, setRestaurants] = useState([]);
  const [favoriteFoods, setFavoriteFoods] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [foodLoading, setFoodLoading] = useState(true);
  const [restaurantLoading, setRestaurantLoading] = useState(true);
  const [foodError, setFoodError] = useState('');
  const [restaurantError, setRestaurantError] = useState('');
  const [favoriteError, setFavoriteError] = useState('');
  const [favoriteBusy, setFavoriteBusy] = useState(new Set());
  const [addBusy, setAddBusy] = useState(null);
  const [cartConflict, setCartConflict] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [pastOrder, setPastOrder] = useState(null);

  useEffect(() => {
    setQuery(new URLSearchParams(location.search).get('q') || '');
  }, [location.search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    moreFoodsController.current?.abort();
    setFoodLoadingMore(false);
    setFoodLoading(true);
    setFoodError('');
    setFoodMoreError('');
    setFoodPage(1);
    setFoodTotal(0);
    api.get('/menu-items/feed', {
      params: {
        page: 1, limit: 12,
        ...(debouncedQuery ? { q: debouncedQuery } : {}),
        ...(cuisine !== 'All' ? { cuisine } : {}),
        ...(openOnly ? { open_only: 'true' } : {}),
        ...(maxPrice ? { max_price: '3000' } : {}),
      },
      signal: controller.signal,
    }).then(({ data }) => {
      setFoods(data.menu_items || []);
      setFoodTotal(Number(data.total || 0));
      setFoodPage(1);
    }).catch(err => {
      if (err.code !== 'ERR_CANCELED') setFoodError(err.response?.data?.error || 'Could not load dishes. Check your connection and retry.');
    }).finally(() => {
      if (!controller.signal.aborted) setFoodLoading(false);
    });
    return () => controller.abort();
  }, [debouncedQuery, cuisine, openOnly, maxPrice, foodRetry]);

  async function loadMoreFoods() {
    if (foodLoadingMore || foodLoading || foods.length >= foodTotal) return;
    const controller = new AbortController();
    moreFoodsController.current = controller;
    setFoodLoadingMore(true);
    setFoodMoreError('');
    try {
      const { data } = await api.get('/menu-items/feed', {
        params: {
          page: foodPage + 1, limit: 12,
          ...(debouncedQuery ? { q: debouncedQuery } : {}),
          ...(cuisine !== 'All' ? { cuisine } : {}),
          ...(openOnly ? { open_only: 'true' } : {}),
          ...(maxPrice ? { max_price: '3000' } : {}),
        },
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setFoods(current => [...current, ...(data.menu_items || [])]);
        setFoodPage(foodPage + 1);
        setFoodTotal(Number(data.total || foodTotal));
      }
    } catch (err) {
      if (err.code !== 'ERR_CANCELED') setFoodMoreError(err.response?.data?.error || 'Could not load more dishes. Please retry.');
    } finally {
      if (moreFoodsController.current === controller) {
        moreFoodsController.current = null;
        setFoodLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    setRestaurantLoading(true);
    setRestaurantError('');
    api.get('/restaurants', { params: { page: 1, limit: 8, ...(debouncedQuery ? { search: debouncedQuery } : {}), ...(openOnly ? { is_open: 'true' } : {}) }, signal: controller.signal })
      .then(({ data }) => setRestaurants(data.restaurants || []))
      .catch(err => {
        if (err.code !== 'ERR_CANCELED') setRestaurantError(err.response?.data?.error || 'Could not load restaurants.');
      })
      .finally(() => { if (!controller.signal.aborted) setRestaurantLoading(false); });
    return () => controller.abort();
  }, [debouncedQuery, openOnly, restaurantRetry]);

  useEffect(() => {
    const controller = new AbortController();
    if (!isAuthenticated) {
      setFavoriteIds(new Set());
      setFavoriteFoods([]);
      setActiveOrder(null);
      setPastOrder(null);
      return () => controller.abort();
    }
    setFavoriteError('');
    api.get('/favorites/restaurants', { signal: controller.signal })
      .then(async ({ data }) => {
        const ids = data.restaurant_ids || [];
        setFavoriteIds(new Set(ids));
        if (!ids.length) { setFavoriteFoods([]); return; }
        const response = await api.get('/menu-items/feed', {
          params: { page: 1, limit: 8, restaurant_ids: ids.join(',') },
          signal: controller.signal,
        });
        setFavoriteFoods(response.data.menu_items || []);
      }).catch(err => {
        if (err.code !== 'ERR_CANCELED') setFavoriteError('Could not load saved restaurants right now.');
      });
    api.get('/orders', { params: { page: 1, limit: 8 }, signal: controller.signal })
      .then(({ data }) => {
        const orders = data.orders || [];
        setActiveOrder(orders.find(order => ACTIVE_STATUSES.has(order.status)) || null);
        setPastOrder(orders.find(order => order.status === 'delivered') || null);
      }).catch(() => {});
    return () => controller.abort();
  }, [isAuthenticated]);

  async function toggleFavorite(id) {
    if (!isAuthenticated || favoriteBusy.has(id)) return;
    setFavoriteBusy(current => new Set(current).add(id));
    setFavoriteError('');
    try {
      if (favoriteIds.has(id)) await api.delete('/favorites/restaurants/' + id);
      else await api.post('/favorites/restaurants/' + id);
      setFavoriteIds(current => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } catch (err) {
      setFavoriteError(err.response?.data?.error || 'Could not update your favorites.');
    } finally {
      setFavoriteBusy(current => { const next = new Set(current); next.delete(id); return next; });
    }
  }

  async function addToCart(item, replace = false) {
    if (!isAuthenticated) {
      setFoodError('Sign in to add dishes to your cart.');
      return;
    }
    if (addBusy !== null) return;
    setAddBusy(item.id);
    setFoodError('');
    try {
      await api.post('/cart/items', { menu_item_id: item.id, quantity: 1, replace });
      await refreshCart();
      setCartConflict(null);
    } catch (err) {
      if (err.response?.status === 409) {
        setCartConflict({ item, message: err.response.data.error });
      } else {
        setFoodError(err.response?.data?.error || 'Could not add this dish. Please try again.');
      }
    } finally {
      setAddBusy(null);
    }
  }

  const categoryPhotos = useMemo(() => CATEGORIES.map(cat =>
    foods.find(food => cat.pattern.test([food.name, food.category].filter(Boolean).join(' ')) && food.image_url)
  ), [foods]);
  const featured = foods.find(food => food.image_url && food.restaurants?.is_open) || foods.find(food => food.image_url) || null;
  const hasFilters = Boolean(debouncedQuery || cuisine !== 'All' || openOnly || maxPrice);
  const restaurantLink = id => '/restaurants/' + id;
  const resetFilters = () => { setQuery(''); setCuisine('All'); setOpenOnly(false); setMaxPrice(false); };
  const chip = (active, label, action) => (
    <button key={label} type="button" onClick={action} aria-pressed={active}
      className={'min-h-10 shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pepper sm:text-sm ' +
        (active ? 'border-pepper bg-pepper text-white' : 'border-hairline bg-paper text-ink-soft hover:border-pepper hover:text-pepper')}>
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6 sm:pt-8">
      {!explore && activeOrder && (
        <Link to={'/orders/' + activeOrder.id}
          className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-pepper/20 bg-paper p-4 transition-colors hover:bg-pepper/5">
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-pepper/10 text-pepper"><Icon name="receipt" size={22}/></span>
            <span className="min-w-0">
              <strong className="block truncate font-display text-sm text-ink">Your order is {activeOrder.status.replace(/_/g, ' ')}</strong>
              <span className="block truncate text-xs text-ink-soft">{activeOrder.restaurants?.name || 'View your order status'}</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-pepper">Track <Icon name="chevron" size={16}/></span>
        </Link>
      )}

      {!explore && (
        <section className="relative isolate overflow-hidden rounded-[28px] bg-pepper text-white sm:rounded-[36px]">
          <div className="pointer-events-none absolute -right-12 -top-28 h-72 w-72 rounded-full border-[38px] border-white/10 sm:h-[440px] sm:w-[440px]"/>
          <div className="relative grid items-center gap-5 px-6 py-9 sm:px-10 sm:py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-14 lg:py-16">
            <div className="relative z-10">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">GOOD FOOD. GOOD MOOD.</p>
              <h1 className="mt-4 max-w-[630px] font-display text-[clamp(2.5rem,5.5vw,5.75rem)] font-bold leading-[1.04] tracking-tight">
                What are you <span className="text-[#FFE0A9]">craving</span> today?
              </h1>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-white/90 sm:text-base">
                Find your next delicious meal from kitchens on Delixious. Discover dishes, pick a restaurant and order with confidence.
              </p>
              <Link to="/explore" className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-paper px-6 py-3 text-sm font-bold text-pepper shadow-lg shadow-ink/10 transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Explore dishes <Icon name="chevron" size={17}/>
              </Link>
            </div>
            <div className="relative mx-auto flex h-[180px] w-full max-w-md items-center justify-center sm:h-[260px] lg:h-[350px]">
              <div className="absolute inset-x-12 top-4 aspect-square rounded-full border-[12px] border-white/15 bg-white/10"/>
              <div className="relative aspect-square h-[170px] overflow-hidden rounded-full border-[10px] border-white/90 bg-[#FFE6CF] shadow-[0_22px_65px_rgba(41,20,11,0.25)] sm:h-[250px] lg:h-[330px]">
                {featured?.image_url ? (
                  <img src={featured.image_url} alt={featured.name} fetchPriority="high" decoding="async" className="h-full w-full object-cover"/>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#FFE7C6] to-[#FFC69A] text-pepper">
                    <Icon name="bag" size={66}/>
                    <span className="font-display text-base font-bold">Delicious starts here</span>
                  </div>
                )}
              </div>
              {featured && <Link to={restaurantLink(featured.restaurant_id)} className="absolute bottom-0 right-0 max-w-[200px] truncate rounded-xl bg-paper px-3 py-2 text-xs font-semibold text-ink shadow-lg">
                {featured.name} · {formatNaira(featured.price)}
              </Link>}
            </div>
          </div>
        </section>
      )}

      <section id="discover" className={(explore ? 'pt-4 ' : 'pt-7 ') + 'scroll-mt-28'}>
        {explore ? (
          <div className="mb-5">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">EXPLORE FOOD</p>
            <h1 className="mt-1 font-display text-3xl font-bold text-ink sm:text-4xl">Find something delicious</h1>
          </div>
        ) : <h2 className="mb-4 font-display text-xl font-bold text-ink">Find your next meal</h2>}
        <SearchField id="discover-dishes" label="Search dishes or ingredients" value={query} onChange={setQuery}
          placeholder="Search jollof rice, shawarma, restaurants..." className="max-w-3xl" />
        <p className="mt-2 text-xs text-ink-soft">Searches current restaurant menus. Delivery availability is confirmed at checkout.</p>
      </section>

      {!explore && <section aria-labelledby="category-heading" className="mt-9">
        <SectionTitle title="What sounds good?" action={<Link to="/explore" className="text-sm font-semibold text-pepper hover:underline">View all</Link>}/>
        <div id="category-heading" className="sr-only">Food categories</div>
        <div className="grid grid-cols-4 gap-2 sm:max-w-2xl sm:gap-5">
          {CATEGORIES.map((cat, idx) => <CategoryCircle key={cat.name} category={cat} food={categoryPhotos[idx]}
            active={query.trim().toLowerCase() === cat.search} onChoose={setQuery}/>)}
        </div>
      </section>}

      <section aria-label="Food filters" className="mt-7 flex flex-wrap gap-2 pb-2">
        {chip(openOnly, 'Open now', () => setOpenOnly(v => !v))}
        {chip(maxPrice, 'Under ₦3,000', () => setMaxPrice(v => !v))}
        <Link to="/restaurants" className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-hairline bg-paper px-4 py-2 text-xs font-semibold text-ink-soft hover:border-pepper hover:text-pepper sm:text-sm">Top rated kitchens</Link>
        <button type="button" onClick={() => setFiltersOpen(value => !value)} aria-expanded={filtersOpen} aria-controls="food-cuisines" className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full border border-hairline bg-paper px-4 py-2 text-xs font-semibold text-ink-soft hover:border-pepper hover:text-pepper sm:text-sm"><Icon name="settings" size={15}/> More filters</button>
        {hasFilters && chip(false, 'Clear filters', resetFilters)}
      </section>
      {filtersOpen && <div id="food-cuisines" className="mt-3 flex flex-wrap gap-2" aria-label="Filter by cuisine">
        {CUISINES.map(item => chip(cuisine === item, item, () => setCuisine(item)))}
      </div>}

      {isAuthenticated && favoriteFoods.length > 0 && !hasFilters && !explore && <section className="mt-9">
        <SectionTitle eyebrow="MADE FOR YOU" title="From your favorite kitchens"
          action={<Link to="/favorites" className="text-sm font-semibold text-pepper hover:underline">Manage favorites</Link>}/>
        {favoriteError && <p role="alert" className="mb-3 text-sm text-danger">{favoriteError}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-5">
          {favoriteFoods.slice(0, 4).map(item => <FoodCard key={item.id} item={item} onAdd={addToCart} adding={addBusy === item.id}/>)}
        </div>
      </section>}

      <section className="mt-9" aria-live="polite">
        <SectionTitle eyebrow="FRESH FROM THE MARKETPLACE" title={explore ? 'Discover dishes' : 'Meals worth exploring'}
          action={<Link to="/restaurants" className="text-sm font-semibold text-pepper hover:underline">Explore restaurants</Link>}>
          {debouncedQuery && <p className="mt-1 text-sm text-ink-soft">Results for “{debouncedQuery}”</p>}
        </SectionTitle>
        {foodLoading ? <GridSkeleton/> : foodError ? (
          <ErrorState message={foodError} onRetry={() => setFoodRetry(value => value + 1)} />
        ) : foods.length ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
              {foods.map(item => <FoodCard key={item.id} item={item} onAdd={addToCart} adding={addBusy === item.id}/>)}
            </div>
            {foods.length < foodTotal && <div className="mt-7 flex flex-col items-center gap-2">
              <p className="text-xs text-ink-soft">Showing {foods.length.toLocaleString()} of {foodTotal.toLocaleString()} dishes</p>
              {foodMoreError && <p role="alert" className="text-sm text-danger">{foodMoreError}</p>}
              <button type="button" onClick={loadMoreFoods} disabled={foodLoadingMore} className="min-h-11 rounded-xl border border-pepper px-6 text-sm font-semibold text-pepper hover:bg-pepper/5 disabled:opacity-50">
                {foodLoadingMore ? 'Loading dishes…' : foodMoreError ? 'Retry loading dishes' : 'Load more dishes'}
              </button>
            </div>}
          </>
        ) : <div className="rounded-2xl border border-hairline bg-paper p-6">
          <EmptyState message="No dishes match those filters right now." />
          <button type="button" onClick={resetFilters} className="mt-3 text-sm font-semibold text-pepper underline">Clear filters</button>
        </div>}
      </section>

      {!explore && pastOrder && <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-hairline bg-paper p-5">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-pepper">WELCOME BACK</p>
          <h2 className="mt-1 font-display text-lg font-bold text-ink">Craving something familiar?</h2>
          <p className="mt-1 text-sm text-ink-soft">Visit {pastOrder.restaurants?.name || 'a restaurant from your orders'} again.</p>
        </div>
        <Link to="/orders" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-pepper px-4 py-2.5 text-sm font-bold text-pepper hover:bg-pepper/5">
          Previous orders <Icon name="chevron" size={17}/>
        </Link>
      </section>}

      <section className="mt-12">
        <SectionTitle eyebrow="EXPLORE BY RESTAURANT" title="Restaurants on Delixious"
          action={<Link to="/restaurants" className="text-sm font-semibold text-pepper hover:underline">See all restaurants</Link>}/>
        {restaurantLoading ? <GridSkeleton/> : restaurantError ? <ErrorState message={restaurantError} onRetry={() => setRestaurantRetry(value => value + 1)}/> : restaurants.length ? (
          <div className="no-scrollbar flex snap-x gap-4 overflow-x-auto pb-3">
            {restaurants.map(restaurant => <div key={restaurant.id} className="w-[264px] shrink-0 snap-start sm:w-[308px]">
              <RestaurantCard restaurant={restaurant} isFavorite={favoriteIds.has(restaurant.id)}
                favoriteBusy={favoriteBusy.has(restaurant.id)} onToggleFavorite={isAuthenticated ? () => toggleFavorite(restaurant.id) : undefined}/>
            </div>)}
          </div>
        ) : <EmptyState message="No approved restaurants are available yet."/>}
      </section>

      {!explore && <section className="mt-12 grid gap-5 overflow-hidden rounded-[28px] bg-ink px-6 py-8 text-white sm:grid-cols-[1fr_auto] sm:items-center sm:px-9">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FFD1B5]">GROW WITH DELIXIOUS</p>
          <h2 className="mt-2 font-display text-2xl font-bold">Great food deserves more customers.</h2>
          <p className="mt-2 max-w-xl text-sm text-white/75">Run a restaurant or deliver orders? Create an account and apply to join Delixious.</p>
        </div>
        <Link to="/signup" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-paper px-5 py-3 text-sm font-bold text-ink hover:bg-sand">Become a partner</Link>
      </section>}

      {!isAuthenticated && <p className="mt-7 text-center text-sm text-ink-soft">
        <Link to="/signup" className="font-semibold text-pepper underline">Create an account</Link> to save favorites, place orders and track delivery.
      </p>}

      {isAuthenticated && itemCount > 0 && <Link to="/cart" className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-4 right-4 z-30 mx-auto flex max-w-lg items-center justify-between rounded-2xl bg-ink px-5 py-3.5 text-sm font-semibold text-white shadow-xl sm:bottom-5 lg:hidden">
        <span>View cart · {itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
        <span>{cartError ? 'Review' : formatNaira(cart?.subtotal || 0)} <Icon name="chevron" size={16} className="ml-1 inline-block"/></span>
      </Link>}
      {cartConflict && <ConfirmModal title="Switch restaurants?" message={cartConflict.message}
        confirmLabel="Replace cart" onCancel={() => setCartConflict(null)} onConfirm={() => addToCart(cartConflict.item, true)}/>}
    </div>
  );
}
