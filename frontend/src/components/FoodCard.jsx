import { Link } from 'react-router-dom';
import Img from './Img.jsx';
import Icon from './ui/Icon.jsx';
import { formatNaira } from '../lib/format.js';

export default function FoodCard({ item, onAdd, adding }) {
  const restaurant = item.restaurants;
  const destination = '/restaurants/' + (restaurant?.id || item.restaurant_id);
  const closed = restaurant?.is_open === false || item.is_available === false;

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-hairline bg-paper transition-all hover:border-pepper/30 hover:shadow-[0_14px_36px_rgba(36,21,18,0.08)]">
      <Link to={destination} className="relative block overflow-hidden" aria-label={'View ' + item.name + ' from ' + (restaurant?.name || 'this restaurant')}>
        <Img src={item.image_url} alt={item.name} fallbackText={item.name?.[0]}
          frameClassName="aspect-[4/3] w-full overflow-hidden bg-[#F1E6D9]"
          imgClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/>
        {closed && <span className="absolute bottom-2 left-2 rounded-full bg-ink/90 px-2.5 py-1 text-[11px] font-semibold text-white">Currently unavailable</span>}
      </Link>
      <div className="flex min-h-[158px] flex-1 flex-col p-3 sm:p-4">
        <Link to={destination} className="line-clamp-2 font-display text-sm font-bold leading-snug text-ink hover:text-pepper sm:text-base">
          {item.name}
        </Link>
        <p className="mt-1 truncate text-xs text-ink-soft">{restaurant?.name || 'Restaurant'}</p>
        <div className="mt-auto flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <span className="font-display text-base font-bold text-ink sm:text-lg">{formatNaira(item.price)}</span>
          <button type="button" onClick={() => onAdd?.(item)} disabled={adding || closed || !onAdd}
            aria-label={'Add ' + item.name + ' to cart'}
            aria-busy={Boolean(adding)}
            className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-pepper px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-pepper-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pepper disabled:cursor-not-allowed disabled:bg-ink-soft sm:w-auto">
            <Icon name="bag" size={15}/>
            {closed ? 'Closed' : adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </article>
  );
}
