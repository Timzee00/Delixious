import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../lib/adminApi.js';
import Icon from '../ui/Icon.jsx';
import SceneIllustration from '../ui/SceneIllustration.jsx';
import { Button } from '../ui/Primitives.jsx';

const integer = value => Number(value || 0).toLocaleString('en-NG');
const naira = value => `₦${Number(value || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

function StatCard({ icon, label, value, note, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-sand text-ink',
    success: 'bg-jade-soft text-jade',
    warning: 'bg-[#FFF2D8] text-[#8A5A00]',
    brand: 'bg-pepper/10 text-pepper',
  };
  return (
    <article className="rounded-2xl border border-hairline bg-paper p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-ink-soft">{label}</p>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon name={icon} size={19}/></span>
      </div>
      <p className="mt-4 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-ink-soft">{note}</p>
    </article>
  );
}

export default function StatsSection() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await adminApi.getStats();
      setStats(data.stats);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load marketplace totals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4,5,6,7,8].map(n => <div key={n} className="h-32 animate-pulse rounded-2xl bg-hairline"/>)}</div>;
  if (error || !stats) return <div className="rounded-2xl border border-hairline bg-paper p-7 text-center"><SceneIllustration scene="unavailable" className="mx-auto h-28 w-40"/><p role="alert" className="text-sm text-danger">{error || 'Marketplace totals are unavailable.'}</p><Button variant="secondary" className="mt-4" onClick={load}>Retry summary</Button></div>;

  const cards = [
    { icon: 'store-front', label: 'Restaurants', value: integer(stats.total_restaurants), note: `${integer(stats.pending_restaurants)} awaiting review`, tone: 'brand' },
    { icon: 'bike', label: 'Riders', value: integer(stats.total_riders), note: `${integer(stats.pending_riders)} awaiting review`, tone: 'neutral' },
    { icon: 'users', label: 'Customers', value: integer(stats.total_customers), note: 'Registered customer accounts', tone: 'neutral' },
    { icon: 'clipboard-list', label: 'Orders', value: integer(stats.total_orders), note: 'All marketplace orders', tone: 'success' },
    { icon: 'banknote', label: 'Order value', value: naira(stats.total_revenue), note: 'Aggregated marketplace value', tone: 'brand' },
    { icon: 'chart-no-axes-column', label: 'Platform commission', value: naira(stats.total_commission), note: 'Recorded platform commission', tone: 'success' },
    { icon: 'clock-3', label: 'Restaurant reviews', value: integer(stats.pending_restaurants), note: 'Partner applications awaiting review', tone: 'warning' },
    { icon: 'shield-check', label: 'Rider reviews', value: integer(stats.pending_riders), note: 'Rider applications awaiting review', tone: 'warning' },
  ];

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">MARKETPLACE PULSE</p><h2 className="mt-1 font-display text-2xl font-bold text-ink">Platform overview</h2><p className="mt-1 text-sm text-ink-soft">Live aggregates from the admin summary view. No sample figures are shown.</p></div>
        <Button variant="secondary" onClick={load}><Icon name="refresh" size={16}/> Refresh totals</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => <StatCard key={card.label} {...card}/>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-hairline bg-paper p-5">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-pepper/10 text-pepper"><Icon name="store-front" size={19}/></span><div><h3 className="font-display text-base font-bold text-ink">Restaurant onboarding</h3><p className="text-xs text-ink-soft">Partner applications waiting for an admin decision</p></div></div>
          <p className="mt-5 font-display text-3xl font-bold text-ink">{integer(stats.pending_restaurants)}</p>
          <p className="mt-1 text-xs text-ink-soft">Pending restaurant applications</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-paper p-5">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-jade-soft text-jade"><Icon name="bike" size={19}/></span><div><h3 className="font-display text-base font-bold text-ink">Rider onboarding</h3><p className="text-xs text-ink-soft">Rider applications waiting for review</p></div></div>
          <p className="mt-5 font-display text-3xl font-bold text-ink">{integer(stats.pending_riders)}</p>
          <p className="mt-1 text-xs text-ink-soft">Pending rider applications</p>
        </div>
      </div>
    </section>
  );
}
