import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import RestaurantCard from '../components/RestaurantCard.jsx';
import { EmptyState, ErrorState, GridSkeleton } from '../components/StateViews.jsx';
import PaginationControls from '../components/ui/PaginationControls.jsx';
import SceneIllustration from '../components/ui/SceneIllustration.jsx';

const PAGE_SIZE = 12;

export default function Favorites() {
  const [restaurants, setRestaurants] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get('/favorites/restaurants', { params: { page, limit: PAGE_SIZE } })
      .then(({ data }) => {
        if (cancelled) return;
        setRestaurants(data.favorites || []);
        setTotal(data.total || 0);
      })
      .catch(err => {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load your favorites.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, retry]);

  async function remove(id) {
    if (busyId) return;
    setBusyId(id);
    setError('');
    try {
      await api.delete(`/favorites/restaurants/${id}`);
      const remaining = restaurants.filter(restaurant => restaurant.id !== id);
      setTotal(value => Math.max(0, value - 1));
      if (!remaining.length && page > 1) setPage(value => value - 1);
      else setRestaurants(remaining);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not remove that restaurant.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-9">
      <Link to="/" className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-pepper hover:underline">Back to home</Link>
      <header className="mt-3 flex items-end justify-between gap-4">
        <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">KEPT CLOSE</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Your favorites</h1><p className="mt-1 text-sm text-ink-soft">Your saved kitchens, in one place.</p></div>
        <SceneIllustration scene="favorites" className="hidden h-24 w-32 sm:block"/>
      </header>

      <div className="mt-7">
        {loading ? <GridSkeleton/> : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)}/> : !restaurants.length ? (
          <EmptyState illustration="favorites" title="No favorites saved yet" message="Tap the heart on a restaurant to keep it close."/>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {restaurants.map(restaurant => <RestaurantCard key={restaurant.id} restaurant={restaurant} isFavorite favoriteBusy={busyId === restaurant.id} onToggleFavorite={() => remove(restaurant.id)}/>)}
            </div>
            <PaginationControls page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} loading={loading}/>
          </>
        )}
      </div>
    </div>
  );
}
