import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useNotifications } from '../context/NotificationsContext.jsx';
import DeliveryLocation from './DeliveryLocation.jsx';
import Icon from './ui/Icon.jsx';

const customerNavigation = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/explore', label: 'Explore', icon: 'compass' },
  { to: '/orders', label: 'Orders', icon: 'receipt' },
  { to: '/wallet', label: 'Wallet', icon: 'wallet' },
  { to: '/account', label: 'Account', icon: 'user' },
];
const roleNavigation = {
  restaurant_owner: [
    { to: '/dashboard', label: 'Workspace', icon: 'store' },
    { to: '/wallet', label: 'Wallet', icon: 'wallet' },
    { to: '/notifications', label: 'Alerts', icon: 'bell' },
    { to: '/account', label: 'Account', icon: 'user' },
  ],
  delivery_agent: [
    { to: '/rider', label: 'Deliveries', icon: 'bike' },
    { to: '/wallet', label: 'Wallet', icon: 'wallet' },
    { to: '/notifications', label: 'Alerts', icon: 'bell' },
    { to: '/account', label: 'Account', icon: 'user' },
  ],
  admin: [
    { to: '/hq', label: 'HQ', icon: 'shield' },
    { to: '/wallet', label: 'Wallet', icon: 'wallet' },
    { to: '/notifications', label: 'Alerts', icon: 'bell' },
    { to: '/account', label: 'Account', icon: 'user' },
  ],
};
const guestNavigation = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/explore', label: 'Explore', icon: 'compass' },
  { to: '/restaurants', label: 'Restaurants', icon: 'store' },
  { to: '/account', label: 'Account', icon: 'user' },
];

export default function Navbar() {
  const { isAuthenticated, profile } = useAuth();
  const { itemCount } = useCart();
  const { unreadCount } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const role = profile?.role;
  const isOperationalRole = ['restaurant_owner', 'delivery_agent', 'admin'].includes(role);
  const navigation = isAuthenticated ? (roleNavigation[role] || customerNavigation) : guestNavigation;
  const showCustomerControls = !isOperationalRole;
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-hairline bg-paper/95 backdrop-blur-lg">
        <div className="mx-auto flex min-h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" aria-label="Delixious home" onClick={closeMenu} className="shrink-0 font-display text-[23px] font-bold tracking-[-0.06em] text-ink sm:text-[27px]">
            Deli<span className="text-pepper">xious</span><span className="ml-0.5 text-pepper">.</span>
          </Link>
          <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
            {navigation.map(item => <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => 'min-h-11 rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-pepper ' +
                (isActive ? 'bg-pepper/10 text-pepper' : 'text-ink-soft hover:bg-sand hover:text-ink')}>{item.label}</NavLink>)}
          </nav>
          {showCustomerControls && <div className="ml-auto min-w-0 max-w-[128px] sm:max-w-none"><DeliveryLocation/></div>}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {isAuthenticated && <Link to="/notifications" aria-label={unreadCount > 0 ? 'Notifications, ' + unreadCount + ' unread' : 'Notifications'}
              className="relative grid h-11 w-11 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-sand hover:text-pepper focus-visible:outline focus-visible:outline-2 focus-visible:outline-pepper">
              <Icon name="bell" size={21}/>
              {unreadCount > 0 && <span aria-hidden="true" className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-pepper px-1 text-[10px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </Link>}
            {showCustomerControls && <Link to="/cart" aria-label={itemCount ? 'Cart, ' + itemCount + ' items' : 'Cart'}
              className="relative grid h-11 w-11 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-sand hover:text-pepper focus-visible:outline focus-visible:outline-2 focus-visible:outline-pepper">
              <Icon name="bag" size={22}/>
              {itemCount > 0 && <span aria-hidden="true" className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-pepper px-1 text-[10px] font-bold text-white">{itemCount > 99 ? '99+' : itemCount}</span>}
            </Link>}
            {!isAuthenticated && <Link to="/login" className="hidden min-h-11 items-center rounded-xl border border-hairline px-4 text-sm font-bold text-ink transition-colors hover:border-pepper hover:text-pepper sm:inline-flex">Sign in</Link>}
            <div className="relative">
              <button type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen}
                aria-controls="delixious-navigation-menu" onClick={() => setMenuOpen(value => !value)}
                className="grid h-11 w-11 place-items-center rounded-xl border border-hairline text-ink-soft transition-colors hover:bg-sand hover:text-pepper focus-visible:outline focus-visible:outline-2 focus-visible:outline-pepper">
                <Icon name={menuOpen ? 'x' : 'menu'} size={22}/>
              </button>
              {menuOpen && <div id="delixious-navigation-menu" className="absolute right-0 top-[calc(100%+10px)] z-50 w-64 overflow-hidden rounded-2xl border border-hairline bg-paper p-2 shadow-[0_18px_55px_rgba(36,21,18,0.16)]">
                <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">{isAuthenticated ? 'Your Delixious menu' : 'Explore Delixious'}</p>
                {navigation.map(item => <NavLink key={item.to} to={item.to} end={item.end} onClick={closeMenu}
                  className={({ isActive }) => 'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ' + (isActive ? 'bg-pepper/10 text-pepper' : 'text-ink hover:bg-sand')}>
                  <Icon name={item.icon} size={18}/>{item.label}<span className="ml-auto"><Icon name="chevron-right" size={16}/></span>
                </NavLink>)}
                {showCustomerControls && <Link to="/cart" onClick={closeMenu} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink hover:bg-sand"><Icon name="shopping-bag" size={18}/>Shopping cart</Link>}
                {!isAuthenticated && <Link to="/login" onClick={closeMenu} className="mt-1 flex min-h-11 items-center gap-3 rounded-xl bg-ink px-3 text-sm font-semibold text-white"><Icon name="log-in" size={18}/>Sign in</Link>}
              </div>}
            </div>
          </div>
        </div>
      </header>
      <nav aria-label="Mobile primary navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-paper/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_rgba(36,21,18,0.06)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid h-[66px] max-w-lg items-stretch px-2" style={{ gridTemplateColumns: `repeat(${navigation.length}, minmax(0, 1fr))` }}>
          {navigation.map(item => <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => 'relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-pepper ' + (isActive ? 'text-pepper' : 'text-ink-soft hover:bg-sand hover:text-ink')}>
            {({ isActive }) => <>{isActive && <span aria-hidden="true" className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-pepper"/>}<Icon name={item.icon} size={21}/><span className="max-w-full truncate">{item.label}</span></>}
          </NavLink>)}
        </div>
      </nav>
    </>
  );
}
