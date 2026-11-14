import { useRef, useState } from 'react';
import { adminApi } from '../../lib/adminApi.js';
import ConfirmModal from '../ConfirmModal.jsx';
import Icon from '../ui/Icon.jsx';
import { Button, InlineStatus } from '../ui/Primitives.jsx';

const AUDIENCES = [
  { value: '', label: 'Everyone on the platform' },
  { value: 'customer', label: 'Customers only' },
  { value: 'restaurant_owner', label: 'Restaurant teams only' },
  { value: 'delivery_agent', label: 'Riders only' },
];

export default function BroadcastSection() {
  const [form, setForm] = useState({ title: '', message: '', role: '' });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [partialCount, setPartialCount] = useState(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const sendLock = useRef(false);

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }));
  }

  async function send() {
    if (sendLock.current) return;
    sendLock.current = true;
    setError('');
    setStatus('');
    setPartialCount(null);
    setSending(true);
    try {
      const { data } = await adminApi.sendBroadcast({
        title: form.title.trim(),
        message: form.message.trim(),
        role: form.role || undefined,
      });
      setStatus(data.message || 'Broadcast completed.');
      setForm({ title: '', message: '', role: '' });
      setConfirming(false);
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'BROADCAST_PARTIAL_FAILURE') {
        setPartialCount(Number(data.sent_count || 0));
        setError(data.error || 'The broadcast stopped partway through. Do not retry until the partial delivery has been reviewed.');
        setConfirming(false);
      } else {
        setError(data?.error || 'Could not send this broadcast.');
      }
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    setPartialCount(null);
    setConfirming(true);
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(270px,.7fr)]">
      <form onSubmit={submit} className="rounded-2xl border border-hairline bg-paper p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-pepper/10 text-pepper"><Icon name="bell" size={21}/></span>
          <div><h2 className="font-display text-xl font-bold text-ink">Platform broadcast</h2><p className="mt-1 text-sm text-ink-soft">Send an in-app notification to a selected audience.</p></div>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-ink">Title
            <input value={form.title} onChange={event => update('title', event.target.value)} maxLength={100} required placeholder="A clear notification headline" className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm font-normal text-ink placeholder:text-ink-soft/60 focus:border-pepper focus:outline-none"/>
            <span className="mt-1 block text-right text-[11px] font-normal text-ink-soft">{form.title.length}/100</span>
          </label>
          <label className="block text-sm font-semibold text-ink">Message
            <textarea value={form.message} onChange={event => update('message', event.target.value)} maxLength={1000} required rows={5} placeholder="Write the information recipients need to know." className="mt-1.5 w-full resize-y rounded-xl border border-hairline bg-paper px-3 py-3 text-sm font-normal leading-6 text-ink placeholder:text-ink-soft/60 focus:border-pepper focus:outline-none"/>
            <span className="mt-1 block text-right text-[11px] font-normal text-ink-soft">{form.message.length}/1,000</span>
          </label>
          <label className="block text-sm font-semibold text-ink">Audience
            <select value={form.role} onChange={event => update('role', event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm font-normal text-ink">
              {AUDIENCES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        </div>

        {error && <div className="mt-4"><InlineStatus tone="error">{error}{partialCount !== null && <span className="mt-1 block font-semibold">Notifications sent before the stop: {partialCount.toLocaleString()}.</span>}</InlineStatus></div>}
        {status && <div className="mt-4"><InlineStatus tone="success">{status}</InlineStatus></div>}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
          <p className="text-xs text-ink-soft">The audience is processed in small batches. Large broadcasts may take longer.</p>
          <Button type="submit" disabled={sending || !form.title.trim() || !form.message.trim()}><Icon name="send" size={16}/> Review and send</Button>
        </div>
      </form>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-hairline bg-paper p-5">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">RECIPIENT PREVIEW</p>
          <h3 className="mt-2 font-display text-lg font-bold text-ink">How it will appear</h3>
          <div className="mt-4 rounded-2xl border border-hairline bg-sand/60 p-4">
            <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-paper text-pepper"><Icon name="bell" size={18}/></span><div className="min-w-0"><p className="break-words text-sm font-bold text-ink">{form.title.trim() || 'Notification title'}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">{form.message.trim() || 'Your notification message will appear here.'}</p><p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">DELIXIOUS · NOW</p></div></div>
          </div>
          <p className="mt-3 text-xs leading-5 text-ink-soft">Only the selected audience receives the notification. No email or SMS is sent by this action.</p>
        </div>
        <div className="rounded-2xl border border-gold/30 bg-[#FFF8E8] p-5">
          <div className="flex items-center gap-2 text-[#8A5A00]"><Icon name="alert" size={18}/><h3 className="text-sm font-bold">Before sending</h3></div>
          <p className="mt-2 text-sm leading-6 text-[#6D521B]">Review the audience and wording. A partially completed broadcast is reported with its sent count; do not blindly resend it.</p>
        </div>
      </aside>

      {confirming && <ConfirmModal title="Send this platform notification?" message={`Audience: ${AUDIENCES.find(item => item.value === form.role)?.label || 'Everyone'}\n\n${form.title.trim()}\n\n${form.message.trim()}`} confirmLabel={sending ? 'Sending…' : 'Send notification'} onCancel={() => { if (!sending) setConfirming(false); }} onConfirm={send}/>}
    </section>
  );
}
