import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import RestaurantCard from '../components/RestaurantCard.jsx';
import { GridSkeleton, EmptyState, ErrorState } from '../components/StateViews.jsx';
import { SearchField } from '../components/ui/Primitives.jsx';
import { BUSINESS_TYPES } from '../data/businessTypes.js';

const CUISINES = ['All', 'Nigerian', 'Continental', 'Chinese', 'Fast Food', 'Grills', 'Seafood', 'Pastries'];

export default function Restaurants() {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [cuisine, setCuisine] = useState('All');
  const [businessType, setBusinessType] = useState(() => searchParams.get('business_type') || 'All');
  const [openOnly, setOpenOnly] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [favoriteBusy, setFavoriteBusy] = useState(new Set());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [favoriteError, setFavoriteError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const first = page === 1;
      first ? setLoading(true) : setLoadingMore(true);
      setError('');
      try {
        const params = { page, limit: 12 };
        if (query.trim()) params.search = query.trim();
        if (cuisine !== 'All') params.cuisine = cuisine;
        if (businessType !== 'All') params.business_type = businessType;
        if (openOnly) params.is_open = true;
        const { data } = await api.get('/restaurants', { params, signal: controller.signal });
        if (cancelled) return;
        const rows = data.restaurants || [];
        setRestaurants(current => first ? rows : [...current, ...rows]);
        setTotal(data.total || 0);

        if (isAuthenticated && rows.length) {
          try {
            const { data: favoriteData } = await api.get('/favorites/restaurants', {
              params: { restaurant_ids: rows.map(restaurant => restaurant.id).join(',') },
              signal: controller.signal,
            });
            if (!cancelled) {
              setFavoriteIds(current => first ? new Set(favoriteData.restaurant_ids || []) : new Set([...current, ...(favoriteData.restaurant_ids || [])]));
              setFavoriteError('');
            }
          } catch (favoriteErr) {
            if (!cancelled && favoriteErr.code !== 'ERR_CANCELED') setFavoriteError('Saved status could not be checked right now.');
          }
        } else if (first) {
          setFavoriteIds(new Set());
          setFavoriteError('');
        }
      } catch (err) {
        if (!cancelled && err.code !== 'ERR_CANCELED') setError(err.response?.data?.error || 'Could not load restaurants right now.');
      } finally {
        if (!cancelled) { setLoading(false); setLoadingMore(false); }
      }
    }, 300);
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [query, cuisine, businessType, openOnly, page, isAuthenticated, retry]);

  async function toggleFavorite(id) {
    if (!isAuthenticated) return;
    setFavoriteBusy((current) => new Set(current).add(id));
    try {
      if (favoriteIds.has(id)) {
        await api.delete(`/favorites/restaurants/${id}`);
        setFavoriteIds((current) => { const next = new Set(current); next.delete(id); return next; });
      } else {
        await api.post(`/favorites/restaurants/${id}`);
        setFavoriteIds((current) => new Set(current).add(id));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update your favorites.');
    } finally {
      setFavoriteBusy((current) => { const next = new Set(current); next.delete(id); return next; });
    }
  }

  const hasMore = restaurants.length < total;

  function chooseBusinessType(value) {
    setBusinessType(value);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (value === 'All') next.delete('business_type');
    else next.set('business_type', value);
    setSearchParams(next);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div><Link to="/" className="text-sm font-medium text-pepper hover:underline">Back to home</Link><h1 className="mt-2 font-display text-3xl font-bold text-ink">Explore food businesses</h1><p className="mt-1 max-w-2xl text-sm text-ink-soft">Find restaurants, bakeries, dessert makers, snack vendors and more. A seller can appear in more than one category.</p></div>
      <div className="ticket mt-6 p-4 sm:p-5">
        <SearchField id="restaurant-search" label="Search food businesses" value={query} onChange={value => { setQuery(value); setPage(1); }} placeholder="Search food businesses..." />
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">Business category</p>
          <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto pb-1">
            <button type="button" onClick={() => chooseBusinessType('All')} aria-pressed={businessType === 'All'} className={'shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ' + (businessType === 'All' ? 'border-pepper bg-pepper text-white' : 'border-hairline text-ink-soft hover:border-pepper')}>All businesses</button>
            {BUSINESS_TYPES.map(type => <button key={type.value} type="button" onClick={() => chooseBusinessType(type.value)} aria-pressed={businessType === type.value} className={'shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ' + (businessType === type.value ? 'border-pepper bg-pepper text-white' : 'border-hairline text-ink-soft hover:border-pepper')}>{type.label}</button>)}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {CUISINES.map((item) => <button key={item} type="button" onClick={() => { setCuisine(item); setPage(1); }} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${cuisine === item ? 'border-pepper bg-pepper/10 text-pepper' : 'border-hairline text-ink-soft hover:border-ink-soft'}`}>{item}</button>)}
          <label className="ml-1 flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={openOnly} onChange={(event) => { setOpenOnly(event.target.checked); setPage(1); }} className="accent-pepper" />Open now</label>
        </div>
      </div>
      {favoriteError && <p role="status" className="mt-4 text-xs text-ink-soft">{favoriteError}</p>}
      <div className="mt-8">
        {loading && !restaurants.length ? <GridSkeleton /> : error && !restaurants.length ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /> : restaurants.length ? (
          <>
            {error && <p role="alert" className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error} <button type="button" onClick={() => setRetry(value => value + 1)} className="ml-1 font-semibold underline">Retry this page</button></p>}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{restaurants.map(restaurant => <RestaurantCard key={restaurant.id} restaurant={restaurant} isFavorite={favoriteIds.has(restaurant.id)} favoriteBusy={favoriteBusy.has(restaurant.id)} onToggleFavorite={isAuthenticated ? () => toggleFavorite(restaurant.id) : undefined}/>)}</div>
            {hasMore && <button type="button" disabled={loadingMore} onClick={() => error ? setRetry(value => value + 1) : setPage(value => value + 1)} className="mt-6 w-full rounded-lg border border-hairline py-3 text-sm font-semibold text-ink-soft hover:border-pepper hover:text-pepper disabled:opacity-60">{loadingMore ? 'Loading...' : error ? 'Retry loading restaurants' : 'Load more restaurants'}</button>}
          </>
        ) : <EmptyState message="No approved food businesses match your search yet." />}
      </div>
    </div>
  );
}
