import { useEffect, useRef, useState } from 'react';
import FoodCard from './FoodCard.jsx';
import Icon from './ui/Icon.jsx';

function getCardLeft(track, card) {
  return track.scrollLeft + card.getBoundingClientRect().left - track.getBoundingClientRect().left;
}

function getNearestIndex(track) {
  const cards = Array.from(track.children);
  if (!cards.length) return 0;

  let nearest = 0;
  let nearestDistance = Infinity;
  cards.forEach((card, index) => {
    const distance = Math.abs(card.getBoundingClientRect().left - track.getBoundingClientRect().left);
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  });
  return nearest;
}

export default function DishCarousel({ items = [], onAdd, addingId }) {
  const trackRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: 0, behavior: 'auto' });
    setActiveIndex(0);
  }, [items[0]?.id]);

  useEffect(() => {
    if (paused || items.length < 2) return undefined;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

      const track = trackRef.current;
      if (!track || track.children.length < 2) return;

      const current = getNearestIndex(track);
      const next = (current + 1) % items.length;
      const card = track.children[next];
      if (!card) return;

      const wrapsToStart = next === 0;
      track.scrollTo({
        left: getCardLeft(track, card),
        behavior: wrapsToStart ? 'auto' : 'smooth',
      });
      setActiveIndex(next);
    }, 10000);

    return () => window.clearInterval(timer);
  }, [items.length, paused]);

  function move(direction) {
    const track = trackRef.current;
    if (!track || items.length < 2) return;

    const current = getNearestIndex(track);
    const next = (current + direction + items.length) % items.length;
    const card = track.children[next];
    if (!card) return;

    track.scrollTo({
      left: getCardLeft(track, card),
      behavior: 'smooth',
    });
    setActiveIndex(next);
  }

  function handleScroll(event) {
    const next = getNearestIndex(event.currentTarget);
    setActiveIndex(current => current === next ? current : next);
  }

  if (!items.length) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-soft">Swipe to explore more dishes</p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="min-w-12 text-right text-xs tabular-nums text-ink-soft" aria-label={`Dish ${activeIndex + 1} of ${items.length}`}>
            {activeIndex + 1} / {items.length}
          </span>
          <button
            type="button"
            onClick={() => move(-1)}
            disabled={items.length < 2}
            aria-label="Previous dish"
            className="grid h-9 w-9 place-items-center rounded-full border border-hairline bg-paper text-ink-soft transition-colors hover:border-pepper hover:text-pepper disabled:opacity-40"
          >
            <Icon name="chevron" size={17} className="rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            disabled={items.length < 2}
            aria-label="Next dish"
            className="grid h-9 w-9 place-items-center rounded-full border border-hairline bg-paper text-ink-soft transition-colors hover:border-pepper hover:text-pepper disabled:opacity-40"
          >
            <Icon name="chevron" size={17} />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        role="region"
        aria-label="Dish gallery. Swipe or use the arrow buttons to browse."
        tabIndex={0}
        onScroll={handleScroll}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
        }}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3 scroll-smooth touch-pan-x focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pepper sm:gap-5"
      >
        {items.map(item => (
          <div key={item.id} className="w-[80vw] max-w-[310px] shrink-0 snap-start sm:w-[270px] lg:w-[285px]">
            <FoodCard item={item} onAdd={onAdd} adding={addingId === item.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
