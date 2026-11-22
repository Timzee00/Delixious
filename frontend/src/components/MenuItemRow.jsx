import { useState } from 'react';
import { formatNaira } from '../lib/format.js';
import Img from './Img.jsx';

export default function MenuItemRow({ item, onAdd, status, disabled = false }) {
  const isAdding = status === 'adding';
  const justAdded = status === 'added';
  const extras = Array.isArray(item.extras) ? item.extras : [];
  const [expanded, setExpanded] = useState(false);
  const [quantities, setQuantities] = useState({});
  const selected = extras.filter(extra => Number(quantities[extra.id] || 0) > 0)
    .map(extra => ({ extra_id: extra.id, quantity: Number(quantities[extra.id]) }));
  const extrasTotal = extras.reduce((sum, extra) => sum + Number(extra.price || 0) * Number(quantities[extra.id] || 0), 0);

  function add() {
    if (extras.length && !expanded) { setExpanded(true); return; }
    onAdd(selected);
  }

  return (
    <div className="ticket p-4">
      <div className="flex items-center gap-4">
        <Img src={item.image_url} fallbackText={item.name?.[0]} frameClassName="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-hairline"/>
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-display text-sm font-bold text-ink">{item.name}</h4>
          {item.description && <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{item.description}</p>}
          <p className="mt-1 font-mono text-sm font-semibold text-pepper">{formatNaira(item.price)}</p>
          {extras.length > 0 && <button type="button" onClick={() => setExpanded(value => !value)} className="mt-1 text-xs font-semibold text-pepper hover:underline" aria-expanded={expanded}>{expanded ? 'Hide extras' : 'Customise with extras'}</button>}
        </div>
        <button type="button" onClick={add} disabled={!item.is_available || disabled || isAdding}
          className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${!item.is_available || disabled ? 'cursor-not-allowed bg-hairline text-ink-soft' : justAdded ? 'bg-jade text-white' : 'bg-pepper text-white hover:bg-pepper-dark'}`}>
          {!item.is_available ? 'Sold out' : disabled ? 'Kitchen closed' : isAdding ? 'Adding...' : justAdded ? 'Added' : extras.length && expanded ? 'Add dish' : extras.length ? 'Choose options' : 'Add dish'}
        </button>
      </div>
      {expanded && extras.length > 0 && (
        <div className="mt-4 border-t border-hairline pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Optional extras</p>
          <div className="mt-2 space-y-2">
            {extras.map(extra => (
              <div key={extra.id} className="flex items-center justify-between gap-3 text-sm">
                <label htmlFor={`extra-${item.id}-${extra.id}`} className="min-w-0 flex-1 text-ink">{extra.name} <span className="text-xs text-ink-soft">+{formatNaira(extra.price)}</span></label>
                <input id={`extra-${item.id}-${extra.id}`} type="number" min="0" max="20" step="1" value={quantities[extra.id] || 0}
                  onChange={event => setQuantities(current => ({...current,[extra.id]:Math.max(0,Math.min(20,Number(event.target.value)||0))}))}
                  className="h-9 w-16 rounded-lg border border-hairline bg-paper px-2 text-center text-sm" aria-label={`Quantity of ${extra.name}`}/>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3">
            <span className="text-xs text-ink-soft">Extras total</span>
            <span className="font-mono text-sm font-semibold text-ink">{formatNaira(extrasTotal)}</span>
          </div>
          <button type="button" onClick={() => onAdd(selected)} disabled={!item.is_available || disabled || isAdding}
            className="mt-3 w-full rounded-lg bg-pepper px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {isAdding ? 'Adding...' : `Add to cart · ${formatNaira(Number(item.price) + extrasTotal)}`}
          </button>
        </div>
      )}
    </div>
  );
}
