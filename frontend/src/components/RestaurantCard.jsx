import { Link } from 'react-router-dom';
import Img from './Img.jsx';
import Icon from './ui/Icon.jsx';
import FavoriteButton from './FavoriteButton.jsx';

export default function RestaurantCard({ restaurant, isFavorite = false, onToggleFavorite, favoriteBusy = false }) {
  return (
    <article className="group h-full overflow-hidden rounded-2xl border border-hairline bg-paper transition-all hover:border-pepper/30 hover:shadow-[0_14px_36px_rgba(36,21,18,0.08)]">
      <div className="relative">
        <Link to={'/restaurants/' + restaurant.id} className="block overflow-hidden">
          <Img src={restaurant.cover_image_url || restaurant.logo_url} alt={restaurant.name}
            fallbackText={restaurant.name?.[0]}
            frameClassName="aspect-[16/9] w-full overflow-hidden bg-[#F1E6D9]"
            imgClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/>
        </Link>
        {onToggleFavorite && <div className="absolute right-3 top-3">
          <FavoriteButton active={isFavorite} onClick={onToggleFavorite} disabled={favoriteBusy}/>
        </div>}
        <span className={'absolute bottom-3 left-3 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ' +
          (restaurant.is_open ? 'bg-jade text-white' : 'bg-paper text-ink')}>
          {restaurant.is_open ? 'Accepting orders' : 'Closed'}
        </span>
      </div>
      <Link to={'/restaurants/' + restaurant.id} className="block p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pepper">
        <div className="flex items-center justify-between gap-3">
          <h3 className="min-w-0 truncate font-display text-base font-bold text-ink group-hover:text-pepper">{restaurant.name}</h3>
          {Number(restaurant.rating_count) > 0 && <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-ink">
            <Icon name="star" size={14} className="text-gold"/>
            {Number(restaurant.rating_avg).toFixed(1)}
          </span>}
        </div>
        {restaurant.cuisine_type && <p className="mt-1 truncate text-sm text-ink-soft">{restaurant.cuisine_type}</p>}
        {restaurant.address && <p className="mt-2 flex items-center gap-1 truncate text-xs text-ink-soft">
          <Icon name="map-pin" size={13} className="shrink-0"/>
          <span className="truncate">{restaurant.address}</span>
        </p>}
      </Link>
    </article>
  );
}
