import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import { useCart } from '../context/CartContext.jsx';
import { formatNaira } from '../lib/format.js';
import { getDeliveryAddress, saveDeliveryAddress } from '../lib/deliveryAddress.js';
import SceneIllustration from '../components/ui/SceneIllustration.jsx';

const STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

export default function Checkout() {
  const { cart, cartError, refreshCart } = useCart();
  const [address, setAddress] = useState(getDeliveryAddress);
  const [state, setState] = useState('');
  const [coords, setCoords] = useState(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [locating, setLocating] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const lat = coords?.lat ?? (manualLat === '' ? null : Number(manualLat));
  const lng = coords?.lng ?? (manualLng === '' ? null : Number(manualLng));
  useEffect(() => {
    let active = true;
    setQuote(null);
    setQuoteError('');
    if (!address.trim() || !state || lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    const timer = window.setTimeout(async () => {
      setQuoteLoading(true);
      try {
        const { data } = await api.post('/orders/quote', {
          delivery_address: address.trim(), delivery_state: state, delivery_lat: lat, delivery_lng: lng,
        });
        if (active) setQuote(data);
      } catch (err) {
        if (active) setQuoteError(err.response?.data?.error || 'Delivery is not available for this location yet.');
      } finally {
        if (active) setQuoteLoading(false);
      }
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [address, state, lat, lng]);

  if (!cart && cartError) {
    return <section role="alert" className="mx-auto max-w-xl px-4 py-16 text-center"><h1 className="font-display text-xl font-bold text-ink">Unable to check your cart</h1><p className="mt-3 text-sm text-ink-soft">{cartError}</p><button type="button" onClick={refreshCart} className="mt-5 min-h-11 rounded-xl bg-pepper px-5 py-2.5 font-semibold text-white">Retry</button></section>;
  }
  if (!cart) return <p role="status" className="px-4 py-16 text-center text-sm text-ink-soft">Loading your cart…</p>;
  if (!cart.items.length) {
    return <div className="mx-auto max-w-md px-4 py-16 text-center"><div className="ticket p-10"><SceneIllustration scene="cart" className="mx-auto mb-3 h-28 w-40"/><h1 className="font-display text-xl font-bold text-ink">Your cart is waiting</h1><p className="mt-2 text-ink-soft">Your cart is empty.</p><Link to="/" className="mt-6 inline-block rounded-lg bg-pepper px-5 py-2.5 font-semibold text-white hover:bg-pepper-dark">Browse restaurants</Link></div></div>;
  }

  async function reverseGeocode(latitude, longitude) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Reverse geocoding failed');
    const data = await response.json();
    return data;
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setError('Location services are not available in this browser.'); return; }
    setLocating(true); setError(''); setQuote(null);
    navigator.geolocation.getCurrentPosition(async position => {
      const latitude = position.coords.latitude, longitude = position.coords.longitude;
      setCoords({ lat: latitude, lng: longitude }); setManualLat(''); setManualLng('');
      try {
        const location = await reverseGeocode(latitude, longitude);
        if (location?.display_name) setAddress(location.display_name);
        const detectedState = location?.address?.state || location?.address?.region || '';
        const matched = STATES.find(value => value.toLowerCase() === detectedState.toLowerCase());
        if (matched) setState(matched);
        else setError('Location captured. Select your delivery state manually to continue.');
      } catch {
        setError('Location captured, but its address could not be resolved. Enter the address and state manually.');
      } finally { setLocating(false); }
    }, () => { setError('Could not get your location. Enter your coordinates manually or retry.'); setLocating(false); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  function updateManualCoordinate(which, value) {
    setCoords(null);
    if (which === 'lat') setManualLat(value);
    else setManualLng(value);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (cartError) { setError('Your cart could not be verified. Please retry the cart before paying.'); return; }
    if (!address.trim() || !state || lat == null || lng == null) { setError('Enter your delivery address, select a state and provide a pinned delivery location.'); return; }
    if (!quote) { setError(quoteError || 'A valid delivery quote is required before payment.'); return; }
    setError(''); setSubmitting(true);
    try {
      saveDeliveryAddress(address);
      const { data } = await api.post('/orders/checkout', {
        delivery_address: address.trim(), delivery_state: state, delivery_lat: lat, delivery_lng: lng,
      });
      window.location.href = data.payment.authorization_url;
    } catch (err) {
      setError(err.response?.data?.error || 'Could not start checkout. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-ink">Checkout</h1>
      <div className="ticket mt-6 p-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-soft">Order summary</h2>
        <div className="mt-3 space-y-3">
          {cart.items.map(item => (
            <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <span className="text-ink">{item.quantity} × {item.menu_item.name}</span>
                {item.selected_extras_snapshot?.length > 0 && <p className="mt-1 text-xs text-ink-soft">{item.selected_extras_snapshot.map(extra => `${extra.quantity} × ${extra.name}`).join(' · ')}</p>}
              </div>
              <span className="shrink-0 font-mono text-ink-soft">{formatNaira(item.line_total)}</span>
            </div>
          ))}
        </div>
        <div className="ticket-divider mt-3 space-y-3 pt-3">
          <div className="flex items-center justify-between"><span className="text-ink-soft">Food subtotal</span><span className="font-mono font-semibold text-ink">{formatNaira(cart.subtotal)}</span></div>
          <div className="flex items-center justify-between text-sm"><span className="text-ink-soft">Delivery fee</span><span className="font-mono font-semibold text-ink">{quote ? formatNaira(quote.delivery_fee) : 'Calculated after location'}</span></div>
          <div className="flex items-center justify-between border-t border-hairline pt-3"><span className="font-semibold text-ink">Total to pay</span><span className="font-display text-xl font-bold text-ink">{quote ? formatNaira(quote.total_amount) : '—'}</span></div>
          {quote?.deliveries?.map(delivery => <p key={delivery.restaurant_id} className="text-xs text-ink-soft">{delivery.restaurant_name}: {delivery.distance_km} km straight-line estimate · {formatNaira(delivery.delivery_fee)} delivery</p>)}
          <p className="text-xs leading-5 text-ink-soft">Delivery is funded by the customer. The restaurant commission is calculated only on food and configured extras; the rider’s payout is the full delivery fee.</p>
          {quoteLoading && <p role="status" className="text-xs text-ink-soft">Calculating delivery availability and fee…</p>}
          {quoteError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{quoteError}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="ticket mt-6 space-y-4 p-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-soft">Delivery address</h2>
        <label htmlFor="checkout-delivery-address" className="block text-sm font-semibold text-ink">Street address and directions</label>
        <textarea id="checkout-delivery-address" value={address} onChange={event => { setAddress(event.target.value); setCoords(null); setQuote(null); }} rows={3} required maxLength={500}
          placeholder="Street, area, landmark and directions" className="w-full resize-none rounded-lg border border-hairline bg-paper px-3 py-2 text-ink placeholder:text-ink-soft/60 focus:border-pepper"/>
        <label className="block text-sm font-semibold text-ink">Delivery state
          <select value={state} onChange={event => { setState(event.target.value); setQuote(null); }} required className="mt-1.5 min-h-11 w-full rounded-lg border border-hairline bg-paper px-3 text-sm text-ink">
            <option value="">Select state</option>{STATES.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <button type="button" onClick={useMyLocation} disabled={locating} className="text-sm font-medium text-pepper hover:underline disabled:opacity-60">{locating ? 'Locating…' : coords ? 'Location captured' : 'Use my current location'}</button>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-ink-soft">Latitude
            <input type="number" step="any" value={coords?.lat ?? manualLat} onChange={event => updateManualCoordinate('lat',event.target.value)} required min="-90" max="90" className="mt-1.5 min-h-11 w-full rounded-lg border border-hairline bg-paper px-3 text-sm text-ink"/>
          </label>
          <label className="block text-xs font-semibold text-ink-soft">Longitude
            <input type="number" step="any" value={coords?.lng ?? manualLng} onChange={event => updateManualCoordinate('lng',event.target.value)} required min="-180" max="180" className="mt-1.5 min-h-11 w-full rounded-lg border border-hairline bg-paper px-3 text-sm text-ink"/>
          </label>
        </div>
        <p className="text-xs leading-5 text-ink-soft">The map pin is used to check the restaurant’s service area and estimate distance. Straight-line distance is used until a road-routing provider is connected.</p>
        {(error || cartError) && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error || cartError}</p>}
        <button type="submit" disabled={submitting || Boolean(cartError) || !quote || quoteLoading} className="w-full rounded-lg bg-pepper py-3 font-semibold text-white transition-colors hover:bg-pepper-dark disabled:opacity-60">{submitting ? 'Redirecting to payment…' : 'Pay with Paystack'}</button>
      </form>
    </div>
  );
}
