import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useNotifications } from '../context/NotificationsContext.jsx';
import DeliveryLocation from './DeliveryLocation.jsx';
import Icon from './ui/Icon.jsx';

const primary = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/explore', label: 'Explore', icon: 'compass' },
  { to: '/orders', label: 'Orders', icon: 'receipt' },
  { to: '/wallet', label: 'Wallet', icon: 'wallet' },
  { to: '/account', label: 'Account', icon: 'user' },
];

export default function Navbar() {
  const { isAuthenticated } = useAuth();
  const { itemCount } = useCart();
  const { unreadCount } = useNotifications();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-hairline bg-paper/95 backdrop-blur-lg">
        <div className="mx-auto flex min-h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" aria-label="Delixious home" className="shrink-0 font-display text-[23px] font-bold tracking-[-0.06em] text-ink sm:text-[27px]">
            Deli<span className="text-pepper">xious</span><span className="ml-0.5 text-pepper">.</span>
          </Link>

          <nav aria-label="Desktop primary navigation" className="hidden items-center gap-1 lg:flex">
            {primary.slice(0, 4).map(item => (
              <NavLink key={item.to} to={item.to} end={item.end}
                className={({ isActive }) => 'min-h-11 rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-pepper ' +
                  (isActive ? 'bg-pepper/10 text-pepper' : 'text-ink-soft hover:bg-sand hover:text-ink')}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto hidden min-w-0 sm:block">
            <DeliveryLocation/>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {isAuthenticated && <Link to="/notifications"
              aria-label={unreadCount > 0 ? 'Notifications, ' + unreadCount + ' unread' : 'Notifications'}
              className="relative grid h-11 w-11 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-sand hover:text-pepper focus-visible:outline focus-visible:outline-2 focus-visible:outline-pepper">
              <Icon name="bell" size={21}/>
              {unreadCount > 0 && <span aria-hidden="true" className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-pepper px-1 text-[10px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </Link>}
            <Link to="/cart" aria-label={itemCount ? 'Cart, ' + itemCount + ' items' : 'Cart'}
              className="relative grid h-11 w-11 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-sand hover:text-pepper focus-visible:outline focus-visible:outline-2 focus-visible:outline-pepper">
              <Icon name="bag" size={22}/>
              {itemCount > 0 && <span aria-hidden="true" className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-pepper px-1 text-[10px] font-bold text-white">{itemCount > 99 ? '99+' : itemCount}</span>}
            </Link>
            <Link to="/account" aria-label={isAuthenticated ? 'Your account' : 'Sign in or create an account'}
              className="hidden h-11 w-11 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-sand hover:text-pepper focus-visible:outline focus-visible:outline-2 focus-visible:outline-pepper sm:grid">
              <Icon name="user" size={21}/>
            </Link>
            {!isAuthenticated && <Link to="/login"
              className="hidden min-h-11 items-center rounded-xl border border-hairline px-4 text-sm font-bold text-ink transition-colors hover:border-pepper hover:text-pepper xl:inline-flex">
              Sign in
            </Link>}
          </div>
        </div>
        <div className="border-t border-hairline/70 px-4 sm:hidden">
          <div className="mx-auto max-w-7xl"><DeliveryLocation/></div>
        </div>
      </header>

      <nav aria-label="Mobile primary navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-paper/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_rgba(36,21,18,0.06)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid h-[66px] max-w-lg grid-cols-5 items-stretch px-2">
          {primary.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => 'relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-pepper ' +
                (isActive ? 'text-pepper' : 'text-ink-soft hover:bg-sand hover:text-ink')}>
              {({ isActive }) => (
                <>
                  {isActive && <span aria-hidden="true" className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-pepper"/>}
                  <Icon name={item.icon} size={21}/>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
