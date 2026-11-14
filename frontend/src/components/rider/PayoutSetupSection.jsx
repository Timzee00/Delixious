import { useState } from 'react';
import api from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Icon from '../ui/Icon.jsx';
import SceneIllustration from '../ui/SceneIllustration.jsx';
import { Button, InlineStatus } from '../ui/Primitives.jsx';

export default function PayoutSetupSection() {
  const { profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({ bank_name: '', bank_code: '', account_number: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const connected = Boolean(profile?.rider_payout_account_connected);
  const last4 = profile?.rider_bank_account_last4;

  function update(event) {
    const { name, value } = event.target;
    setForm(current => ({
      ...current,
      [name]: name === 'account_number' ? value.replace(/\D/g, '').slice(0, 10) : value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (form.account_number.length !== 10) {
      setError('Enter a valid 10-digit account number.');
      return;
    }
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const { data } = await api.post('/auth/rider/bank-details', form);
      setMessage(data.message || 'Payout account connected.');
      setForm({ bank_name: '', bank_code: '', account_number: '' });
      await refreshProfile();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to verify payout details. Check the bank information and retry.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="max-w-2xl space-y-5">
      <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">PAYOUT DETAILS</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-ink">Your bank account</h2>
        <p className="mt-1 text-sm leading-6 text-ink-soft">Set up the verified account used for delivery payouts.</p>
      </div>

      {connected ? (
        <div className="rounded-2xl border border-jade/20 bg-paper p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-jade-soft text-jade"><Icon name="shield-check" size={24}/></span>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-lg font-bold text-ink">Payout account connected</h3>
              <p className="mt-1 text-sm text-ink-soft">{profile?.rider_bank_name || 'Verified bank account'}{last4 ? ` · ending ${last4}` : ''}</p>
              <p className="mt-2 text-xs leading-5 text-ink-soft">Account details are hidden after verification. Contact support to request a change; adding another account here could create a duplicate provider recipient.</p>
            </div>
          </div>
          {message && <InlineStatus tone="success" className="mt-4">{message}</InlineStatus>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-hairline bg-paper">
          <div className="grid items-center gap-4 bg-sand/70 p-4 sm:grid-cols-[auto_1fr] sm:p-5">
            <SceneIllustration scene="payment" className="mx-auto h-24 w-32 sm:mx-0"/>
            <div><p className="font-display text-base font-bold text-ink">Verified payouts</p><p className="mt-1 text-sm leading-6 text-ink-soft">Paystack checks the bank account before connecting it to your rider profile.</p></div>
          </div>
          <form onSubmit={submit} className="space-y-4 p-4 sm:p-6">
            <label className="block text-sm font-semibold text-ink">Bank name
              <input name="bank_name" value={form.bank_name} onChange={update} required maxLength={80} autoComplete="organization" placeholder="e.g. Access Bank" className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm font-normal text-ink placeholder:text-ink-soft/60 focus:border-pepper focus:outline-none"/>
            </label>
            <label className="block text-sm font-semibold text-ink">Paystack bank code
              <input name="bank_code" value={form.bank_code} onChange={update} required maxLength={20} placeholder="Enter your bank's Paystack code" className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm font-normal text-ink placeholder:text-ink-soft/60 focus:border-pepper focus:outline-none"/>
            </label>
            <label className="block text-sm font-semibold text-ink">10-digit account number
              <input name="account_number" inputMode="numeric" autoComplete="off" pattern="[0-9]{10}" maxLength={10} value={form.account_number} onChange={update} required placeholder="0123456789" className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-base font-normal tracking-wider text-ink placeholder:text-ink-soft/60 focus:border-pepper focus:outline-none"/>
            </label>
            <div className="flex items-start gap-2 rounded-xl bg-sand px-3 py-3 text-xs leading-5 text-ink-soft"><Icon name="lock" size={16} className="mt-0.5 shrink-0"/><p>Delixious never asks for your PIN, card number or one-time password for payout setup.</p></div>
            {error && <InlineStatus tone="error">{error}</InlineStatus>}
            {message && <InlineStatus tone="success">{message}</InlineStatus>}
            <div className="flex justify-end"><Button type="submit" busy={saving} disabled={saving || form.account_number.length !== 10}>Verify and connect</Button></div>
          </form>
        </div>
      )}
    </section>
  );
}
