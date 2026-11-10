import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from '../components/ui/Icon.jsx';

const common = [
  { to: '/favorites', icon: 'heart', label: 'Saved restaurants', description: 'Your favorite kitchens' },
  { to: '/notifications', icon: 'bell', label: 'Notifications', description: 'Order and account updates' },
  { to: '/contact', icon: 'info', label: 'Help and support', description: 'Get assistance when you need it' },
  { to: '/faq', icon: 'receipt', label: 'Frequently asked questions', description: 'Answers before you order' },
  { to: '/about', icon: 'store', label: 'About Delixious', description: 'Learn about the platform' },
];

export default function AccountHub() {
  const { profile, user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      setError('Could not confirm sign-out. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const workspace = profile?.role === 'admin' ? { to: '/hq', label: 'Administration HQ' } :
    profile?.role === 'restaurant_owner' ? { to: '/dashboard', label: 'Restaurant workspace' } :
    profile?.role === 'delivery_agent' ? { to: '/rider', label: 'Rider workspace' } : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="font-mono text-xs font-semibold uppercase tracking-widest text-pepper">YOUR DELIXIOUS</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">Account & more</h1>
      {isAuthenticated ? (
        <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-hairline bg-paper p-5">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-bold text-ink">{profile?.full_name || 'Your account'}</h2>
            <p className="mt-1 truncate text-sm text-ink-soft">{user?.email}</p>
          </div>
          <Link to="/profile" className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-hairline px-4 text-sm font-semibold text-pepper hover:border-pepper">
            Edit profile
          </Link>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-hairline bg-paper p-6">
          <h2 className="font-display text-xl font-bold text-ink">Good food starts here.</h2>
          <p className="mt-2 text-sm text-ink-soft">Sign in to track orders, save favorites and manage your account.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/login" className="inline-flex min-h-11 items-center rounded-xl bg-pepper px-5 text-sm font-semibold text-white">Sign in</Link>
            <Link to="/signup" className="inline-flex min-h-11 items-center rounded-xl border border-hairline px-5 text-sm font-semibold text-ink">Create account</Link>
          </div>
        </div>
      )}

      {workspace && <Link to={workspace.to} className="mt-5 flex min-h-16 items-center gap-3 rounded-2xl border border-pepper/25 bg-pepper/5 px-5 text-ink hover:border-pepper">
        <Icon name="store" size={22} className="text-pepper"/>
        <span className="flex-1 text-sm font-bold">{workspace.label}</span>
        <Icon name="chevron" size={18}/>
      </Link>}

      <div className="mt-7 overflow-hidden rounded-2xl border border-hairline bg-paper">
        {common.filter(item => isAuthenticated || item.to !== '/favorites' && item.to !== '/notifications').map((item, i) => (
          <Link key={item.to} to={item.to} className={'flex min-h-16 items-center gap-4 px-5 py-3 transition-colors hover:bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-pepper ' + (i ? 'border-t border-hairline' : '')}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand text-pepper"><Icon name={item.icon} size={20}/></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{item.label}</span>
              <span className="block text-xs text-ink-soft">{item.description}</span>
            </span>
            <Icon name="chevron" size={17} className="text-ink-soft"/>
          </Link>
        ))}
      </div>

      <div className="mt-7 rounded-2xl border border-hairline bg-paper p-5">
        <h2 className="font-display text-lg font-bold text-ink">Grow with Delixious</h2>
        <p className="mt-2 text-sm text-ink-soft">Own a restaurant or deliver food? Apply to join the platform.</p>
        <Link to="/signup" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-pepper hover:underline">Become a partner <Icon name="chevron" size={16}/></Link>
      </div>

      {isAuthenticated && <div className="mt-6">
        {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
        <button type="button" disabled={busy} aria-busy={busy} onClick={signOut}
          className="min-h-11 rounded-xl border border-hairline bg-paper px-5 text-sm font-bold text-ink hover:border-danger hover:text-danger disabled:opacity-50">
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      </div>}
    </div>
  );
}
