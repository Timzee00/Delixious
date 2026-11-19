import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from './Modal.jsx';
import Icon from './ui/Icon.jsx';

const PAGE_SIZE = 10;

function StarRating({ rating, size = 15 }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(value => (
        <svg key={value} width={size} height={size} viewBox="0 0 24 24" fill={value <= rating ? '#E7A33E' : '#E8E1DC'} aria-hidden="true">
          <path d="m12 2.7 2.85 5.78 6.38.93-4.62 4.5 1.09 6.36L12 17.27l-5.7 3 1.09-6.36-4.62-4.5 6.38-.93L12 2.7Z"/>
        </svg>
      ))}
    </span>
  );
}

function reviewDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function ReviewSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-hairline bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-full bg-sand"/>
        <span className="flex-1 space-y-2">
          <span className="block h-3 w-28 rounded bg-sand"/>
          <span className="block h-2.5 w-20 rounded bg-sand"/>
        </span>
      </div>
      <span className="mt-4 block h-3 w-full rounded bg-sand"/>
      <span className="mt-2 block h-3 w-4/5 rounded bg-sand"/>
    </div>
  );
}

export default function RestaurantReviewsModal({ restaurant, onClose }) {
  const { isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({
    rating_avg: Number(restaurant.rating_avg || 0),
    rating_count: Number(restaurant.rating_count || 0),
  });
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');
    setReviews([]);
    setNextCursor(null);
    setHasMore(false);

    api.get(`/restaurants/${restaurant.id}/reviews`, {
      params: { limit: PAGE_SIZE },
      signal: controller.signal,
    }).then(({ data }) => {
      if (!active) return;
      setReviews(data.reviews || []);
      setSummary(data.restaurant || {
        rating_avg: Number(restaurant.rating_avg || 0),
        rating_count: Number(restaurant.rating_count || 0),
      });
      setNextCursor(data.next_cursor || null);
      setHasMore(Boolean(data.has_more));
    }).catch(err => {
      if (active && err.code !== 'ERR_CANCELED') {
        setError(err.response?.data?.error || 'Could not load restaurant reviews.');
      }
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [restaurant.id, retry]);

  async function loadMore() {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const { data } = await api.get(`/restaurants/${restaurant.id}/reviews`, {
        params: { limit: PAGE_SIZE, cursor: nextCursor },
      });
      setReviews(current => {
        const knownIds = new Set(current.map(review => review.id));
        return [...current, ...(data.reviews || []).filter(review => !knownIds.has(review.id))];
      });
      setNextCursor(data.next_cursor || null);
      setHasMore(Boolean(data.has_more));
      if (data.restaurant) setSummary(data.restaurant);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load more reviews. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }

  const average = Number(summary.rating_avg || 0);
  const reviewCount = Number(summary.rating_count || 0);

  return (
    <Modal onClose={onClose} labelledBy="restaurant-reviews-title" describedBy="restaurant-reviews-description" className="max-h-[88vh] max-w-2xl overflow-y-auto sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-pepper">CUSTOMER FEEDBACK</p>
          <h2 id="restaurant-reviews-title" className="mt-1 truncate font-display text-2xl font-bold text-ink">Reviews for {restaurant.name}</h2>
          <p id="restaurant-reviews-description" className="mt-1 text-sm text-ink-soft">Feedback from customers who completed an order with this restaurant.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close reviews" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-hairline text-ink-soft transition hover:border-pepper hover:text-pepper">
          <Icon name="x" size={18}/>
        </button>
      </div>

      <section className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-hairline bg-white p-4 sm:p-5" aria-label="Overall restaurant rating">
        <div className="min-w-[90px]">
          <p className="font-display text-4xl font-bold leading-none text-ink tabular-nums">{average.toFixed(1)}</p>
          <StarRating rating={Math.round(average)} size={16}/>
          <p className="mt-1 text-xs text-ink-soft">Overall rating</p>
        </div>
        <div className="h-14 w-px bg-hairline"/>
        <div>
          <p className="font-display text-2xl font-bold text-ink tabular-nums">{reviewCount.toLocaleString()}</p>
          <p className="text-xs text-ink-soft">{reviewCount === 1 ? 'Customer review' : 'Customer reviews'}</p>
          <p className="mt-1 text-[11px] text-ink-soft">Newest reviews appear first</p>
        </div>
      </section>

      <div className="mt-5 flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold text-ink">What customers say</h3>
        <span className="rounded-full bg-[#FFF0E8] px-3 py-1 text-[11px] font-semibold text-pepper">Verified orders</span>
      </div>

      <div className="mt-3 space-y-3">
        {loading ? (
          <>
            <ReviewSkeleton/>
            <ReviewSkeleton/>
          </>
        ) : error && reviews.length === 0 ? (
          <div role="alert" className="rounded-2xl border border-hairline bg-white p-5 text-center">
            <p className="text-sm text-danger">{error}</p>
            <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-3 min-h-10 rounded-xl border border-pepper px-4 text-sm font-semibold text-pepper hover:bg-pepper/5">Retry</button>
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-hairline bg-white px-5 py-9 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF0E8] text-pepper"><Icon name="receipt-text" size={22}/></span>
            <h4 className="mt-3 font-display text-lg font-bold text-ink">No reviews yet</h4>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-ink-soft">When customers complete an order and share their experience, their feedback will appear here.</p>
          </div>
        ) : (
          reviews.map(review => {
            const reviewer = (review.reviewer_name || 'Delixious customer').trim();
            return (
              <article key={review.id} className="rounded-2xl border border-hairline bg-white p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#FFF0E8] font-display text-sm font-bold text-pepper" aria-hidden="true">
                    {reviewer.charAt(0).toUpperCase() || 'D'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h4 className="truncate text-sm font-bold text-ink">{reviewer}</h4>
                      {review.verified_purchase && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF5EF] px-2 py-0.5 text-[10px] font-semibold text-[#26764A]">
                          <Icon name="circle-check" size={12}/> Verified order
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-soft">{reviewDate(review.created_at)}</p>
                    <div className="mt-2"><StarRating rating={review.rating}/></div>
                  </div>
                </div>
                {review.comment ? (
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">{review.comment}</p>
                ) : (
                  <p className="mt-3 text-xs italic text-ink-soft/75">Rated without a written comment</p>
                )}
              </article>
            );
          })
        )}
      </div>

      {error && reviews.length > 0 && <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {!loading && hasMore && (
        <button type="button" onClick={loadMore} disabled={loadingMore} className="mt-4 min-h-11 w-full rounded-xl border border-pepper px-4 py-2.5 text-sm font-semibold text-pepper transition hover:bg-pepper/5 disabled:opacity-60">
          {loadingMore ? 'Loading older reviews…' : 'Load older reviews'}
        </button>
      )}

      <div className="mt-5 rounded-2xl bg-sand p-4">
        <p className="text-sm font-semibold text-ink">Ordered from this restaurant?</p>
        <p className="mt-1 text-xs leading-5 text-ink-soft">Reviews unlock after delivery. If your checkout included multiple restaurants, each delivered restaurant order has its own review on your Orders page.</p>
        <Link to={isAuthenticated ? '/orders' : '/login'} onClick={onClose} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-pepper px-4 py-2 text-sm font-semibold text-white transition hover:bg-pepper-dark">
          {isAuthenticated ? 'Go to my orders' : 'Sign in to review'}
          <Icon name="arrow-right" size={15}/>
        </Link>
      </div>
    </Modal>
  );
}
