import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api.js';
import FormField from '../FormField.jsx';
import ImagePicker from '../ImagePicker.jsx';
import Icon from '../ui/Icon.jsx';
import { Button, InlineStatus } from '../ui/Primitives.jsx';
import { BUSINESS_TYPES } from '../../data/businessTypes.js';

const CUISINES = ['Nigerian', 'Continental', 'Chinese', 'Fast Food', 'Grills', 'Seafood', 'Pastries', 'Other'];

export default function RestaurantProfileSection({ restaurant, onCreated, onUpdated }) {
  const isEdit = Boolean(restaurant);
  const [form, setForm] = useState({
    name: restaurant?.name || '',
    description: restaurant?.description || '',
    cuisine_type: restaurant?.cuisine_type || CUISINES[0],
    business_types: Array.isArray(restaurant?.business_types) && restaurant.business_types.length ? restaurant.business_types : ['restaurant'],
    address: restaurant?.address || '',
    logo_url: restaurant?.logo_url || '',
    cover_image_url: restaurant?.cover_image_url || '',
  });
  const [saving, setSaving] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ bank_name: '', bank_code: '', account_number: '' });
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState('');
  const [payoutError, setPayoutError] = useState('');
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) { setError('Business name and address are required.'); return; }
    if (!form.business_types.length || form.business_types.length > 3) { setError('Choose between one and three business types.'); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      if (isEdit) { const { data } = await api.put(`/restaurants/${restaurant.id}`, form); onUpdated(data.restaurant); setMessage('Business details saved.'); }
      else { const { data } = await api.post('/restaurants', form); onCreated(data.restaurant); setMessage('Food business created.'); }
    } catch (err) { setError(err.response?.data?.error || 'Could not save your food business.'); }
    finally { setSaving(false); }
  }

  function toggleBusinessType(value) {
    setForm(current => {
      const selected = current.business_types || [];
      if (selected.includes(value)) {
        return selected.length > 1 ? { ...current, business_types: selected.filter(item => item !== value) } : current;
      }
      if (selected.length >= 3) return current;
      return { ...current, business_types: [...selected, value] };
    });
  }

  async function copyStorefrontLink() {
    if (!restaurant) return;
    const url = window.location.origin + '/restaurants/' + (restaurant.slug || restaurant.id);
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage('Storefront link copied.');
    } catch {
      setCopyMessage(url);
    }
  }

  async function handlePayoutSubmit(event) {
    event.preventDefault();
    setPayoutSaving(true);
    setPayoutError('');
    setPayoutMessage('');
    try {
      const { data } = await api.post(`/restaurants/${restaurant.id}/bank-details`, payoutForm);
      onUpdated({ ...restaurant, ...(data.restaurant || {}), payout_account_connected: true });
      setPayoutMessage(data.message || 'Payout account verified and connected.');
      setPayoutForm({ bank_name: '', bank_code: '', account_number: '' });
    } catch (err) {
      setPayoutError(err.response?.data?.error || 'Could not verify this payout account. Check the bank details and retry.');
    } finally {
      setPayoutSaving(false);
    }
  }

  async function handleToggleOpen() {
    setTogglingOpen(true); setError('');
    try { const { data } = await api.patch(`/restaurants/${restaurant.id}/toggle-open`); onUpdated(data.restaurant); }
    catch (err) { setError(err.response?.data?.error || 'Could not update open status.'); }
    finally { setTogglingOpen(false); }
  }

  return (
    <div className="space-y-6">
      {isEdit && (
        <section className="rounded-2xl border border-hairline bg-paper p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-pepper">Public storefront</p>
              <h2 className="mt-1 font-display text-lg font-bold text-ink">Your customer link</h2>
              <p className="mt-1 break-all text-xs text-ink-soft">{window.location.origin}/restaurants/{restaurant.slug || restaurant.id}</p>
              {copyMessage && <p role="status" className="mt-1 text-xs font-semibold text-jade">{copyMessage}</p>}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link to={'/restaurants/' + (restaurant.slug || restaurant.id)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-hairline px-3 text-sm font-semibold text-ink hover:border-pepper hover:text-pepper">
                <Icon name="arrow-up-right" size={16}/> View store
              </Link>
              <Button type="button" variant="secondary" onClick={copyStorefrontLink}>Copy link</Button>
            </div>
          </div>
        </section>
      )}

      {isEdit && (
        <section className="rounded-2xl border border-hairline bg-paper p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${restaurant.payout_account_connected ? 'bg-jade-soft text-jade' : 'bg-sand text-ink'}`}>
              <Icon name={restaurant.payout_account_connected ? 'shield-check' : 'bank'} size={21}/>
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-bold text-ink">Business payout account</h2>
              <p className="mt-1 text-sm leading-6 text-ink-soft">Connect a business bank account through Paystack before accepting paid customer orders.</p>
            </div>
          </div>
          {restaurant.payout_account_connected ? (
            <InlineStatus tone="success" className="mt-4"><span className="inline-flex items-center gap-2 font-semibold"><Icon name="circle-check" size={16}/> Payout account connected</span><span className="mt-1 block text-xs font-normal">The account connection is recorded. Bank details are not displayed here.</span></InlineStatus>
          ) : (
            <form onSubmit={handlePayoutSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-ink">Bank name
                <input name="bank_name" autoComplete="organization" value={payoutForm.bank_name} onChange={event => setPayoutForm(current => ({ ...current, bank_name: event.target.value }))} required maxLength={80} placeholder="e.g. Access Bank" className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm text-ink placeholder:text-ink-soft/60 focus:border-pepper focus:outline-none"/>
              </label>
              <label className="block text-sm font-medium text-ink">Paystack bank code
                <input name="bank_code" value={payoutForm.bank_code} onChange={event => setPayoutForm(current => ({ ...current, bank_code: event.target.value }))} required maxLength={20} placeholder="Bank code from Paystack" className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm text-ink placeholder:text-ink-soft/60 focus:border-pepper focus:outline-none"/>
              </label>
              <label className="block text-sm font-medium text-ink sm:col-span-2">10-digit account number
                <input name="account_number" type="text" inputMode="numeric" autoComplete="off" pattern="[0-9]{10}" value={payoutForm.account_number} onChange={event => setPayoutForm(current => ({ ...current, account_number: event.target.value.replace(/\D/g, '').slice(0, 10) }))} required placeholder="Enter business account number" className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm text-ink placeholder:text-ink-soft/60 focus:border-pepper focus:outline-none"/>
              </label>
              <div className="sm:col-span-2 rounded-xl bg-sand px-4 py-3 text-xs leading-5 text-ink-soft">Paystack verifies the bank details and creates the restaurant payout connection. Never enter a card PIN, password or one-time code here.</div>
              {payoutError && <div role="alert" className="sm:col-span-2"><InlineStatus tone="error">{payoutError}</InlineStatus></div>}
              {payoutMessage && <div role="status" className="sm:col-span-2"><InlineStatus tone="success">{payoutMessage}</InlineStatus></div>}
              <div className="sm:col-span-2 flex justify-end"><Button type="submit" busy={payoutSaving} disabled={payoutSaving || payoutForm.account_number.length !== 10}>Verify and connect account</Button></div>
            </form>
          )}
        </section>
      )}

      {isEdit && (
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="ticket p-4"><p className="text-xs font-mono uppercase tracking-wider text-ink-soft">Restaurant status</p><div className="mt-2 flex flex-wrap items-center gap-3"><p className={`font-display text-lg font-bold ${restaurant.is_open ? 'text-jade' : 'text-ink-soft'}`}>{restaurant.is_open ? 'Open for orders' : 'Closed'}</p>{restaurant.approval_status && <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-semibold capitalize text-ink-soft">Approval: {restaurant.approval_status}</span>}</div></div>
          <button onClick={handleToggleOpen} disabled={togglingOpen} className={`rounded-xl border-2 bg-transparent px-5 py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${restaurant.is_open ? 'border-ink-soft text-ink-soft hover:bg-ink-soft/10' : 'border-jade text-jade hover:bg-jade/10'}`}>{togglingOpen ? 'Updating...' : restaurant.is_open ? 'Close restaurant' : 'Open restaurant'}</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="ticket p-5 sm:p-7">
        <div className="mb-6"><h2 className="font-display text-lg font-bold text-ink">Food business details</h2><p className="mt-1 text-sm text-ink-soft">This information helps customers discover your store and the products you sell.</p></div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2"><FormField label="Business name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required /></div>
          <fieldset className="md:col-span-2">
            <legend className="mb-1 text-sm font-semibold text-ink">What does your business sell?</legend>
            <p className="mb-3 text-xs leading-5 text-ink-soft">Choose up to three. Your storefront will appear in every selected category, so customers can find all sides of your business.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {BUSINESS_TYPES.map(type => {
                const selected = form.business_types.includes(type.value);
                const locked = !selected && form.business_types.length >= 3;
                return (
                  <button key={type.value} type="button" aria-pressed={selected} disabled={locked}
                    onClick={() => toggleBusinessType(type.value)}
                    className={'flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ' +
                      (selected ? 'border-pepper bg-pepper/5 text-pepper' : 'border-hairline bg-white text-ink-soft hover:border-pepper/50') +
                      (locked ? ' cursor-not-allowed opacity-40' : '')}>
                    <span className={'grid h-8 w-8 shrink-0 place-items-center rounded-lg ' + (selected ? 'bg-pepper text-white' : 'bg-sand text-ink-soft')}><Icon name={type.icon} size={17}/></span>
                    <span className="min-w-0 flex-1">{type.label}</span>
                    {selected && <Icon name="check" size={17}/>}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs font-medium text-ink-soft">{form.business_types.length} of 3 selected</p>
          </fieldset>
          <div><span className="mb-1 block text-sm font-medium text-ink">Cuisine type</span><select value={form.cuisine_type} onChange={(e) => setForm({ ...form, cuisine_type: e.target.value })} className="w-full rounded-lg border border-hairline bg-paper px-3 py-2 text-ink focus:border-pepper">{CUISINES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><FormField label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} required /></div>
          <div className="md:col-span-2"><FormField label="Description" as="textarea" rows={4} value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Tell customers what makes your restaurant and food worth trying." /></div>
        </div>

        <div className="mt-7 border-t border-hairline pt-6"><h3 className="font-display text-base font-bold text-ink">Branding</h3><p className="mt-1 text-sm text-ink-soft">Use a clear logo and food-focused cover image for the marketplace.</p><div className="mt-4 grid gap-5 sm:grid-cols-2"><ImagePicker label="Logo" url={form.logo_url} category="logo" onUploaded={(url) => setForm((f) => ({ ...f, logo_url: url }))} size="h-28 w-full" /><ImagePicker label="Cover image" url={form.cover_image_url} category="cover" onUploaded={(url) => setForm((f) => ({ ...f, cover_image_url: url }))} size="h-28 w-full" /></div></div>

        {message && <p role="status" aria-live="polite" className="mt-5 rounded-lg bg-jade-soft px-3 py-2 text-sm text-jade">{message}</p>}
        {error && <p role="alert" aria-live="polite" className="mt-5 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <button type="submit" disabled={saving} className="mt-6 w-full rounded-lg bg-pepper py-3 font-semibold text-white hover:bg-pepper-dark disabled:opacity-60">{saving ? 'Saving...' : isEdit ? 'Save business details' : 'Create food business'}</button>
      </form>
    </div>
  );
}
