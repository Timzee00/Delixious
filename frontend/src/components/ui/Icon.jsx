import React from 'react';

/**
 * Delixious icon family: accessible by default when an aria-label is supplied,
 * decorative when nested beside text. Always inline SVG; never emoji glyphs.
 */
const PATHS = {
  'map-pin': <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.7" /></>,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.4 8.6-2.5 4.3-4.3 2.5 2.5-4.3 4.3-2.5Z" /></>,
  heart: <path d="M20.8 8.5c0 4-8.8 10.5-8.8 10.5S3.2 12.5 3.2 8.5a4.9 4.9 0 0 1 8.8-2.9 4.9 4.9 0 0 1 8.8 2.9Z" />,
  star: <path d="m12 2.9 2.9 6 6.6.9-4.8 4.7 1.2 6.6-5.9-3.1-5.9 3.1 1.1-6.6-4.7-4.7 6.6-.9 2.9-6Z" />,
  'arrow-right': <path d="M4 12h16m-6-6 6 6-6 6" />,
  home: <><path d="m3 10 9-7 9 7v10H3V10Z" /><path d="M9 20v-7h6v7" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 4.5 4.5" /></>,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
  cart: <><circle cx="9" cy="20" r="1" /><circle cx="19" cy="20" r="1" /><path d="M2 3h3l2.2 11.5a2 2 0 0 0 2 1.5h9.4a2 2 0 0 0 2-1.5L22 7H6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 9h18M16 14h2" /></>,
  'arrow-up-right': <><path d="m7 17 10-10M8 7h9v9" /></>,
  arrowUp: <><path d="m7 17 10-10M8 7h9v9" /></>,
  'arrow-down-left': <><path d="m7 7 10 10M7 17h9V8" /></>,
  arrowDown: <><path d="m7 7 10 10M7 17h9V8" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14-5L4 8M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14 5l2-2m0 4v-4h-4" /></>,
  store: <><path d="m3 10 2-7h14l2 7v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0v-2ZM5 16v5h14v-5" /></>,
  bike: <><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="m12 17.5-4-8h6l4.5 8M9.5 11l-4 6.5M13 7h3" /></>,
  receipt: <><path d="M4 3h16v18l-4-2-4 2-4-2-4 2V3Z" /><path d="M8 8h8M8 12h6" /></>,
  bank: <><path d="m3 10 9-7 9 7M4 10h16M6 10v9m4-9v9m4-9v9m4-9v9M3 21h18" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7h.01" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" /><circle cx="16" cy="17" r="2" fill="currentColor" stroke="none" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 17h.01" /></>,
  bag: <><path d="M6.5 8.5h11l1 11h-13l1-11Z" /><path d="M9 8.5V6a3 3 0 0 1 6 0v2.5" /></>,
  orders: <><path d="M8 4h12v17H5V7l3-3Z" /><path d="M8 4v4H5M10 12h6M10 16h6" /></>,
  utensils: <><path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M17 3v18M17 3c2 2 3 4 3 7h-3"/></>,
  'chef-hat': <><path d="M5 11a4 4 0 1 1 7-3 4 4 0 1 1 7 3v4H5v-4Z"/><path d="M5 15v4h14v-4M8 15v-3m8 3v-3"/></>,
  'clipboard-list': <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h3"/></>,
  truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></>,
  'package-check': <><path d="m12 3 8 4v10l-8 4-8-4V7l8-4Z"/><path d="m4 7 8 4 8-4M12 11v10m-4-6 2 2 4-4"/></>,
  'credit-card': <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
  'chart-no-axes-column': <><path d="M4 20V11h4v9M10 20V4h4v16M16 20v-7h4v7M2 20h20"/></>,
  'receipt-text': <><path d="M5 3h14v18l-3.5-2L12 21l-3.5-2L5 21V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
  'shield-check': <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
  'clock-3': <><circle cx="12" cy="12" r="9"/><path d="M12 7v5h5"/></>,
  'map': <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15m6-12v15"/></>,
  'store-front': <><path d="m3 10 2-7h14l2 7v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0v-2Z"/><path d="M5 16v5h14v-5"/></>,
  'heart-handshake': <><path d="M20.5 8.5c0 4-8.5 10-8.5 10s-8.5-6-8.5-10a4.5 4.5 0 0 1 8.5-2.2 4.5 4.5 0 0 1 8.5 2.2Z"/><path d="m8 12 2 2 2-1 2 1 2-2"/></>,
  'circle-check': <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
  'circle-alert': <><circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3h.01"/></>,
  'arrow-left': <><path d="M20 12H4m6 6-6-6 6-6"/></>,
  'chevron-left': <path d="m15 18-6-6 6-6"/>,
  'chevron-right': <path d="m9 18 6-6-6-6"/>,
  filter: <><path d="M4 6h16M7 12h10m-7 6h4"/><circle cx="8" cy="6" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/></>,
  'calendar-clock': <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/><circle cx="14" cy="15" r="3"/><path d="M14 13.5v1.7l1.2.8"/></>,
  'banknote': <><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9H5v1m13-1h1v1m-13 4H5v1m13-1h1v1"/></>,
  'chef-apron': <><path d="M8 4 12 2l4 2 4 5-3 2-2-2v10H9V9l-2 2-3-2 4-5Z"/><path d="M9 14h6"/></>,
  'route': <><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/></>,
  send: <><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  minus: <path d="M5 12h14"/>,
  pencil: <><path d="m14 5 5 5M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/></>,
  'trash-2': <><path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m4 4v7m6-7v7"/></>,
  'arrow-down-up': <><path d="m7 3-3 3 3 3M4 6h12m1 15 3-3-3-3m3 3H8"/></>,
  'circle-dot': <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></>,
  'sparkles': <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16ZM5 3l.5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5L5 3Z"/></>,
};

export const ICON_NAMES = Object.freeze(Object.keys(PATHS));

export default function Icon({ name, size = 20, className = '', title, ...rest }) {
  const shape = PATHS[name];
  if (!shape) return null;
  const isLabeled = Boolean(title || rest['aria-label']);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      className={className} role={isLabeled ? 'img' : undefined}
      aria-hidden={isLabeled ? undefined : true}
      aria-label={rest['aria-label'] || title}
      {...rest}>
      {title && <title>{title}</title>}
      {shape}
    </svg>
  );
}
