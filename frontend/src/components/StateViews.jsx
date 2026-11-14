import { Button } from './ui/Primitives.jsx';
import SceneIllustration from './ui/SceneIllustration.jsx';

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="ticket animate-pulse">
          <div className="h-36 w-full overflow-hidden rounded-t-xl bg-hairline" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 rounded bg-hairline" />
            <div className="h-3 w-1/3 rounded bg-hairline" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ message, title, action, illustration = 'discovery' }) {
  return (
    <div className="rounded-2xl border border-hairline bg-paper px-5 py-10 text-center sm:px-8">
      <SceneIllustration scene={illustration} className="mx-auto mb-3 h-28 w-40" />
      {title && <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>}
      <p className="mt-2 text-sm leading-6 text-ink-soft">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger/20 bg-paper px-5 py-10 text-center sm:px-8">
      <SceneIllustration scene="unavailable" className="mx-auto mb-3 h-28 w-40" />
      <p className="font-semibold text-danger">Something could not load</p>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{message}</p>
      {onRetry && <Button className="mt-5" onClick={onRetry} variant="secondary">Try again</Button>}
    </div>
  );
}
