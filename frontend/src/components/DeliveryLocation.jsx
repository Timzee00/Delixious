import { useEffect, useRef, useState } from 'react';
import Icon from './ui/Icon.jsx';
import { getDeliveryAddress, saveDeliveryAddress } from '../lib/deliveryAddress.js';

export default function DeliveryLocation() {
  const [address, setAddress] = useState(getDeliveryAddress);
  const [draft, setDraft] = useState(address);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();
    function closeOnOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function save(event) {
    event.preventDefault();
    const saved = saveDeliveryAddress(draft);
    setAddress(saved);
    setOpen(false);
  }

  function clear() {
    saveDeliveryAddress('');
    setAddress('');
    setDraft('');
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button type="button" aria-expanded={open} aria-controls="delivery-location-panel"
        onClick={() => { setDraft(address); setOpen(v => !v); }}
        className="flex min-h-11 max-w-full items-center gap-2 rounded-xl px-1 py-2 text-left transition-colors hover:bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-pepper sm:px-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pepper/10 text-pepper">
          <Icon name="map-pin" size={19}/>
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Delivering to</span>
          <span className="block max-w-[220px] truncate text-xs font-bold text-ink sm:max-w-[170px] sm:text-sm">
            {address || 'Choose your delivery address'}
          </span>
        </span>
        <Icon name="chevron-down" size={16} className="shrink-0 text-ink-soft"/>
      </button>
      {open && (
        <form id="delivery-location-panel" onSubmit={save}
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-[min(88vw,340px)] rounded-2xl border border-hairline bg-paper p-4 text-ink shadow-xl sm:left-auto sm:right-0">
          <label htmlFor="delivery-location-input" className="block text-sm font-semibold">Delivery address</label>
          <p className="mt-1 text-xs leading-5 text-ink-soft">Save an address for checkout. Restaurant coverage is confirmed before placing an order.</p>
          <input id="delivery-location-input" ref={inputRef} value={draft}
            onChange={event => setDraft(event.target.value)} maxLength={240}
            placeholder="Street address, area, city" autoComplete="street-address"
            className="mt-3 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm text-ink focus:border-pepper focus:outline-none focus:ring-2 focus:ring-pepper/20"/>
          <div className="mt-3 flex items-center justify-between gap-3">
            <button type="button" onClick={clear} className="min-h-10 rounded-lg px-2 text-xs font-semibold text-ink-soft hover:text-pepper">Clear</button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-lg px-3 text-xs font-semibold text-ink-soft hover:bg-sand">Cancel</button>
              <button type="submit" disabled={!draft.trim()} className="min-h-10 rounded-lg bg-pepper px-4 text-xs font-semibold text-white hover:bg-pepper-dark disabled:opacity-50">Save address</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
