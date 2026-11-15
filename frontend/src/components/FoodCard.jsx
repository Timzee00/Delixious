import { Link } from 'react-router-dom';
import Img from './Img.jsx';
import Icon from './ui/Icon.jsx';
import { formatNaira } from '../lib/format.js';

export default function FoodCard({ item, onAdd, adding }) {
  const restaurant = item.restaurants;
  const destination = '/restaurants/' + (restaurant?.id || item.restaurant_id);
  const closed = restaurant?.is_open === false || item.is_available === false;
  const rating = Number(restaurant?.rating_avg || 0);

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#F2E6DE] bg-white shadow-[0_8px_24px_rgba(76,38,19,0.06)] transition-all hover:-translate-y-0.5 hover:border-pepper/30 hover:shadow-[0_14px_32px_rgba(76,38,19,0.11)]">
      <Link to={destination} className="relative block overflow-hidden" aria-label={'View ' + item.name + ' from ' + (restaurant?.name || 'this restaurant')}>
        <Img src={item.image_url} alt={item.name} fallbackText={item.name?.[0]}
          frameClassName="aspect-[4/3] w-full overflow-hidden bg-[#F1E6D9]"
          imgClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/>
        {closed && <span className="absolute bottom-2 left-2 rounded-full bg-ink/90 px-2.5 py-1 text-[10px] font-semibold text-white">Currently unavailable</span>}
        {rating > 0 && <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-ink shadow-sm"><Icon name="star" size={13} className="fill-[#F59E0B] text-[#F59E0B]"/>{rating.toFixed(1)}</span>}
        {item.category && <span className="absolute bottom-2 right-2 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-ink shadow-sm">{item.category}</span>}
      </Link>
      <div className="flex min-h-[145px] flex-1 flex-col p-3.5 sm:p-4">
        <Link to={destination} className="line-clamp-2 font-display text-sm font-bold leading-snug text-ink transition-colors hover:text-pepper sm:text-base">{item.name}</Link>
        <p className="mt-1 truncate text-xs text-ink-soft">{restaurant?.name || 'Restaurant'}</p>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#F3E8E0] pt-3">
          <span className="font-display text-base font-bold text-pepper sm:text-lg">{formatNaira(item.price)}</span>
          <button type="button" onClick={() => onAdd?.(item)} disabled={adding || closed || !onAdd}
            aria-label={'Add ' + item.name + ' to cart'} aria-busy={Boolean(adding)}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-pepper px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-pepper-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pepper disabled:cursor-not-allowed disabled:bg-ink-soft">
            {closed ? 'Closed' : adding ? 'Adding…' : 'Add'}
            {!closed && !adding && <Icon name="plus" size={14}/>}
          </button>
        </div>
      </div>
    </article>
  );
}
