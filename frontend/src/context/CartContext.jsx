import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState(null);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartError, setCartError] = useState('');

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(null);
      setCartError('');
      setCartLoading(false);
      return;
    }
    setCartLoading(true);
    setCartError('');
    try {
      const { data } = await api.get('/cart');
      setCart(data);
    } catch (err) {
      // A failed read isn't an empty cart. Preserve the last known basket
      // and show a retry action, including after a browser wakes from sleep.
      setCartError(err.response?.data?.error || 'Could not load your cart. Check your connection and try again.');
    } finally {
      setCartLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { refreshCart(); }, [refreshCart]);

  const itemCount = useMemo(() => (cart?.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0), [cart]);
  const value = { cart, cartLoading, cartError, itemCount, refreshCart };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider.');
  return ctx;
}
