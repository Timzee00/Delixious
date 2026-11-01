import Icon from './ui/Icon.jsx';

export default function PageLoader({ label = 'Loading page…' }) {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 px-4 py-12" role="status" aria-live="polite">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-paper text-pepper" aria-hidden="true">
        <Icon name="refresh" size={22} className="animate-spin" />
      </span>
      <span className="text-sm font-medium text-ink-soft">{label}</span>
    </div>
  );
}
