// A delivery address is user-entered and stays in this browser tab.
// It is not a geofence, availability guarantee, or confirmed order address.
const KEY = 'delixious.deliveryAddress';

export function getDeliveryAddress() {
  try { return window.sessionStorage.getItem(KEY) || ''; }
  catch { return ''; }
}

export function saveDeliveryAddress(address) {
  const value = String(address || '').trim().slice(0, 240);
  try {
    if (value) window.sessionStorage.setItem(KEY, value);
    else window.sessionStorage.removeItem(KEY);
  } catch { /* Private browsing may restrict storage; entry still works in this view. */ }
  return value;
}
