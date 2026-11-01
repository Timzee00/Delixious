import { useRef } from 'react';
import Icon from './Icon.jsx';

const BUTTON_STYLES = {
  primary: 'border-pepper bg-pepper text-white hover:bg-pepper-dark hover:border-pepper-dark',
  secondary: 'border-hairline bg-paper text-ink hover:border-pepper hover:text-pepper',
  subtle: 'border-transparent bg-transparent text-ink-soft hover:bg-sand hover:text-ink',
  danger: 'border-danger bg-danger text-white hover:brightness-90',
};

export function Button({
  children, variant = 'primary', busy = false, disabled = false,
  className = '', type = 'button', ...rest
}) {
  return (
    <button type={type} disabled={disabled || busy} aria-busy={busy}
      className={`relative inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold
        transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pepper
        disabled:cursor-not-allowed disabled:opacity-60 ${BUTTON_STYLES[variant] || BUTTON_STYLES.secondary} ${className}`}
      {...rest}>
      <span className={busy ? 'opacity-0' : ''}>{children}</span>
      {busy && <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="animate-spin">
          <path d="M12 3a9 9 0 1 1-9 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </span>}
      {busy && <span className="sr-only">Processing…</span>}
    </button>
  );
}

export function SearchField({ value, onChange, label = 'Search', placeholder = 'Search…', id, className = '' }) {
  const ref = useRef(null);
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-soft" aria-hidden="true">
        <Icon name="search" size={19} />
      </span>
      <input id={id} ref={ref} type="search" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-xl border border-hairline bg-paper py-3 pl-11 pr-12 text-sm text-ink
          placeholder:text-ink-soft/60 focus:border-pepper focus:outline-none focus:ring-2 focus:ring-pepper/20" />
      {value && (
        <button type="button" onClick={() => { onChange(''); ref.current?.focus(); }}
          aria-label={`Clear ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-lg text-ink-soft
            hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-pepper">
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

export function Panel({ as: Component = 'section', children, className = '', ...props }) {
  return <Component className={`rounded-2xl border border-hairline bg-paper ${className}`} {...props}>{children}</Component>;
}

export function InlineStatus({ tone = 'info', children, className = '' }) {
  const styles = {
    info: 'border-hairline bg-paper text-ink-soft',
    success: 'border-jade/20 bg-jade-soft text-jade',
    error: 'border-danger/20 bg-danger/10 text-danger',
    warning: 'border-gold/30 bg-sand text-ink',
  };
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm leading-6 ${styles[tone] || styles.info} ${className}`}>{children}</div>;
}
