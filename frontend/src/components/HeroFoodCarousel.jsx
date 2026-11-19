import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './ui/Icon.jsx';
import { formatNaira } from '../lib/format.js';

function nearestSlide(track) {
  if (!track?.children?.length) return 0;
  const left = track.getBoundingClientRect().left;
  let bestIndex = 0;
  let bestDistance = Infinity;
  Array.from(track.children).forEach((slide, index) => {
    const distance = Math.abs(slide.getBoundingClientRect().left - left);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

export default function HeroFoodCarousel({ items = [] }) {
  const trackRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slides = items.filter(item => item?.image_url).slice(0, 8);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: 0, behavior: 'auto' });
    setActiveIndex(0);
  }, [slides[0]?.id]);

  useEffect(() => {
    if (paused || slides.length < 2) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

      const track = trackRef.current;
      if (!track) return;
      const current = nearestSlide(track);
      const next = (current + 1) % slides.length;
      const nextSlide = track.children[next];
      if (!nextSlide) return;

      track.scrollTo({
        left: nextSlide.offsetLeft,
        behavior: next === 0 ? 'auto' : 'smooth',
      });
      setActiveIndex(next);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [activeIndex, paused, slides.length]);

  function move(direction) {
    const track = trackRef.current;
    if (!track || slides.length < 2) return;
    const next = (nearestSlide(track) + direction + slides.length) % slides.length;
    const slide = track.children[next];
    if (!slide) return;
    track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
    setActiveIndex(next);
  }

  function handleScroll(event) {
    const next = nearestSlide(event.currentTarget);
    setActiveIndex(current => current === next ? current : next);
  }

  if (!slides.length) {
    return (
      <div className="relative mx-auto flex h-[180px] w-full max-w-md items-center justify-center sm:h-[260px] lg:h-[350px]">
        <div className="relative aspect-square h-[170px] overflow-hidden rounded-full border-[10px] border-white/90 bg-[#FFE6CF] shadow-[0_22px_65px_rgba(41,20,11,0.25)] sm:h-[250px] lg:h-[330px]">
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#FFE7C6] to-[#FFC69A] text-pepper">
            <Icon name="bag" size={66}/>
            <span className="font-display text-base font-bold">Delicious starts here</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative mx-auto h-[180px] w-full max-w-md sm:h-[260px] lg:h-[350px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute inset-x-12 top-4 aspect-square rounded-full border-[12px] border-white/15 bg-white/10"/>
      <div
        ref={trackRef}
        role="region"
        aria-label="Featured dishes"
        aria-roledescription="carousel"
        tabIndex={0}
        onScroll={handleScroll}
        onPointerDown={() => setPaused(true)}
        onPointerUp={event => { if (event.pointerType !== 'mouse') setPaused(false); }}
        onPointerCancel={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
        }}
        className="no-scrollbar relative z-[1] flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth touch-pan-x focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {slides.map((item, index) => (
          <div key={item.id} className="relative flex h-full w-full shrink-0 snap-center items-center justify-center">
            <Link
              to={'/restaurants/' + (item.restaurant_id || item.restaurants?.id || '')}
              aria-label={'View ' + item.name}
              className="relative block aspect-square h-[170px] overflow-hidden rounded-full border-[10px] border-white/90 bg-[#FFE6CF] shadow-[0_22px_65px_rgba(41,20,11,0.25)] sm:h-[250px] lg:h-[330px]"
            >
              <img
                src={item.image_url}
                alt={item.name || 'Featured dish'}
                loading={index === 0 ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : 'auto'}
                decoding="async"
                draggable="false"
                className="h-full w-full select-none object-cover"
              />
            </Link>
            <Link
              to={'/restaurants/' + (item.restaurant_id || item.restaurants?.id || '')}
              className="absolute bottom-0 right-1 z-10 max-w-[min(200px,70%)] truncate rounded-xl bg-paper px-3 py-2 text-xs font-semibold text-ink shadow-lg sm:right-0 sm:px-4 sm:text-sm"
            >
              {item.name} · {formatNaira(item.price)}
            </Link>
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Previous featured dish"
            className="absolute left-0 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-paper/95 text-ink shadow-lg transition hover:bg-white sm:left-1"
          >
            <Icon name="chevron" size={17} className="rotate-180"/>
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Next featured dish"
            className="absolute right-0 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-paper/95 text-ink shadow-lg transition hover:bg-white sm:right-1"
          >
            <Icon name="chevron" size={17}/>
          </button>
          <span className="sr-only" aria-live="polite">
            Featured dish {activeIndex + 1} of {slides.length}
          </span>
        </>
      )}
    </div>
  );
}
