import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AvailableDeliveriesSection from '../components/rider/AvailableDeliveriesSection.jsx';
import MyDeliveriesSection from '../components/rider/MyDeliveriesSection.jsx';
import EarningsSection from '../components/rider/EarningsSection.jsx';
import PayoutSetupSection from '../components/rider/PayoutSetupSection.jsx';
import Icon from '../components/ui/Icon.jsx';
import SceneIllustration from '../components/ui/SceneIllustration.jsx';

const TABS = [
  { id: 'Available', label: 'Available jobs', icon: 'route' },
  { id: 'My Deliveries', label: 'My deliveries', icon: 'truck' },
  { id: 'Earnings', label: 'Earnings', icon: 'banknote' },
  { id: 'Payout Setup', label: 'Payout setup', icon: 'bank' },
];

export default function RiderDashboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('Available');
  const isApproved = profile?.rider_approval_status === 'approved';

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-9">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">RIDER WORKSPACE</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Your deliveries</h1><p className="mt-1 text-sm text-ink-soft">Find jobs, manage active drop-offs and review recorded payouts.</p></div>
        <Link to="/wallet" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-hairline bg-paper px-4 text-sm font-semibold text-ink hover:border-pepper hover:text-pepper"><Icon name="wallet" size={17}/> Wallet</Link>
      </header>

      <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-paper p-4">
        <div className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${isApproved ? 'bg-jade-soft text-jade' : 'bg-sand text-ink-soft'}`}><Icon name={isApproved ? 'shield-check' : 'clock-3'} size={20}/></span><div><p className="text-sm font-semibold text-ink">{isApproved ? 'Rider account approved' : 'Rider approval pending'}</p><p className="mt-0.5 text-xs text-ink-soft">{isApproved ? 'You can claim eligible paid deliveries.' : 'You can prepare your payout details while the team reviews your account.'}</p></div></div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${isApproved ? 'bg-jade-soft text-jade' : 'bg-sand text-ink-soft'}`}>{profile?.rider_approval_status || 'pending'}</span>
      </section>

      <div className="mt-6 border-b border-hairline">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Rider workspace sections">
          {TABS.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
            className={`inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${tab === item.id ? 'border-pepper text-pepper' : 'border-transparent text-ink-soft hover:text-ink'}`}>
            <Icon name={item.icon} size={17}/>{item.label}
          </button>)}
        </div>
      </div>

      <div className="mt-6">
        {tab === 'Available' && (isApproved ? <AvailableDeliveriesSection/> : (
          <div className="rounded-2xl border border-hairline bg-paper p-7 text-center"><SceneIllustration scene="delivery" className="mx-auto h-32 w-44"/><h2 className="mt-2 font-display text-xl font-bold text-ink">Your job feed is locked for now</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">Once your rider account is approved, paid orders that are ready for pickup will appear here.</p></div>
        ))}
        {tab === 'My Deliveries' && <MyDeliveriesSection/>}
        {tab === 'Earnings' && <EarningsSection/>}
        {tab === 'Payout Setup' && <PayoutSetupSection/>}
      </div>
    </div>
  );
}
