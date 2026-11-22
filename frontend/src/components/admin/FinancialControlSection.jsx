import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../lib/adminApi.js';
import Icon from '../ui/Icon.jsx';

const money = value => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency: 'NGN', maximumFractionDigits: 2,
}).format(Number(value || 0) / 100);

function Metric({ label, value, note, tone = 'default' }) {
  return (
    <div className="rounded-2xl border border-hairline bg-paper p-4 sm:p-5">
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      <p className={`mt-2 break-words font-display text-2xl font-bold tracking-tight ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}>{value}</p>
      {note && <p className="mt-2 text-xs leading-5 text-ink-soft">{note}</p>}
    </div>
  );
}

export default function FinancialControlSection() {
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState(null);
  const [journals, setJournals] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [events, setEvents] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [payoutCursor, setPayoutCursor] = useState(null);
  const [payoutHasMore, setPayoutHasMore] = useState(false);
  const [eventCursor, setEventCursor] = useState(null);
  const [eventHasMore, setEventHasMore] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    const [{ data: summaryData }, { data: healthData }] = await Promise.all([
      adminApi.getFinancialSummary({ days: 30 }),
      adminApi.getFinancialHealth(),
    ]);
    setSummary(summaryData.summary || null);
    setHealth(healthData.health || null);
  }, []);

  const loadJournals = useCallback(async (nextCursor = null, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const { data } = await adminApi.listFinancialJournals({
        limit: 25,
        ...(nextCursor ? { cursor: nextCursor } : {}),
      });
      setJournals(current => append ? [...current, ...(data.journals || [])] : (data.journals || []));
      setCursor(data.next_cursor || null);
      setHasMore(Boolean(data.has_more));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load financial records.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const loadQueues = useCallback(async () => {
    setQueueLoading(true);
    try {
      const [payoutResult, eventResult] = await Promise.all([
        adminApi.listFinancialPayouts({ limit: 25 }),
        adminApi.listProviderEvents({ limit: 25 }),
      ]);
      setPayouts(payoutResult.data.payouts || []);
      setPayoutCursor(payoutResult.data.next_cursor || null);
      setPayoutHasMore(Boolean(payoutResult.data.has_more));
      setEvents(eventResult.data.events || []);
      setEventCursor(eventResult.data.next_cursor || null);
      setEventHasMore(Boolean(eventResult.data.has_more));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load payout and provider queues.');
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const loadMorePayouts = useCallback(async () => {
    if (!payoutCursor) return;
    setQueueLoading(true);
    try {
      const { data } = await adminApi.listFinancialPayouts({ limit: 25, cursor: payoutCursor });
      setPayouts(current => [...current, ...(data.payouts || [])]);
      setPayoutCursor(data.next_cursor || null);
      setPayoutHasMore(Boolean(data.has_more));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load more payouts.');
    } finally {
      setQueueLoading(false);
    }
  }, [payoutCursor]);

  const loadMoreEvents = useCallback(async () => {
    if (!eventCursor) return;
    setQueueLoading(true);
    try {
      const { data } = await adminApi.listProviderEvents({ limit: 25, cursor: eventCursor });
      setEvents(current => [...current, ...(data.events || [])]);
      setEventCursor(data.next_cursor || null);
      setEventHasMore(Boolean(data.has_more));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load more provider events.');
    } finally {
      setQueueLoading(false);
    }
  }, [eventCursor]);

  const refresh = useCallback(async () => {
    setError('');
    try {
      await loadSummary();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load financial summary.');
    }
    await Promise.all([loadJournals(), loadQueues()]);
  }, [loadSummary, loadJournals, loadQueues]);

  useEffect(() => { refresh(); }, [refresh]);

  const accountBalance = code => Number(summary?.system_accounts?.find(item => item.account_code === code)?.balance_kobo || 0);
  const payoutQueue = summary?.payout_queue || {};
  const eventQueue = summary?.provider_event_queue || {};

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">FINANCIAL OPERATIONS</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink">Financial control centre</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">Read-only financial oversight. Every posted journal must balance; payout and wallet funding controls remain locked until provider and settlement checks are complete.</p>
        </div>
        <button type="button" onClick={refresh} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-hairline bg-paper px-3 py-2 text-sm font-semibold text-ink hover:border-pepper">
          <Icon name="refresh" size={16}/> Refresh
        </button>
      </div>

      {error && <div role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

      <section className="rounded-2xl border border-hairline bg-paper p-4 sm:p-5" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Automated financial health checks</p>
            <p className="mt-1 text-xs text-ink-soft">Database watchdog runs every 15 minutes, including when the free web service is asleep.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${health?.status === 'critical' ? 'bg-danger/10 text-danger' : health?.status === 'warning' ? 'bg-sand text-ink' : 'bg-sand text-ink'}`}>
            {health?.status || 'Checking'}
          </span>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          {health?.checked_at ? `Last checked ${new Date(health.checked_at).toLocaleString('en-NG')}` : 'No completed check is available yet.'}
          {health ? ` · ${health.critical_count || 0} critical · ${health.warning_count || 0} warnings` : ''}
        </p>
        {health?.checks?.length > 0 && (
          <ul className="mt-3 space-y-2">
            {health.checks.map(item => (
              <li key={item.code} className="rounded-xl border border-hairline px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{item.message}</span>
                  <span className="text-xs font-semibold text-ink-soft">{item.count} record(s) · {item.severity}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {health?.status === 'healthy' && <p className="mt-2 text-sm text-ink-soft">No financial exceptions were detected by the latest internal checks.</p>}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Posted journals" value={Number(summary?.total_journals || 0).toLocaleString('en-NG')} note="All-time immutable accounting records"/>
        <Metric label="Platform commission ledger" value={money(accountBalance('SYS:PLATFORM_COMMISSION_REVENUE'))} note="Ledger balance, not necessarily bank cash"/>
        <Metric label="Restaurant payable control" value={money(accountBalance('SYS:RESTAURANT_PAYABLE'))} note="Amount recorded as owed to restaurants"/>
        <Metric label="Rider payable control" value={money(accountBalance('SYS:RIDER_PAYABLE'))} note="Amount recorded as owed to riders"/>
        <Metric label="Paystack clearing" value={money(accountBalance('SYS:PAYSTACK_CLEARING'))} note="Provider clearing control account"/>
        <Metric label="Failed payouts" value={Number(payoutQueue.failed || 0).toLocaleString('en-NG')} note="Requires reconciliation before retry" tone={payoutQueue.failed ? 'danger' : 'default'}/>
        <Metric label="Payouts on hold" value={Number(payoutQueue.on_hold || 0).toLocaleString('en-NG')} note="Recipient verification or manual review"/>
        <Metric label="Payouts processing" value={Number(payoutQueue.processing || 0).toLocaleString('en-NG')} note="Awaiting final provider confirmation"/>
        <Metric label="Failed provider events" value={Number(eventQueue.failed || 0).toLocaleString('en-NG')} note="Webhook processing needs review" tone={eventQueue.failed ? 'danger' : 'default'}/>
        <Metric label="Unbalanced journals" value={Number(summary?.unbalanced_journals || 0).toLocaleString('en-NG')} note="Must remain zero" tone={summary?.unbalanced_journals ? 'danger' : 'default'}/>
        <Metric label="Recent journals (30 days)" value={Number(summary?.recent_journals || 0).toLocaleString('en-NG')} note="Bounded reporting window"/>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {['available','pending','held'].map(bucket => (
          <div key={bucket} className="rounded-xl border border-hairline bg-paper px-4 py-3">
            <p className="text-xs capitalize text-ink-soft">Wallet {bucket}</p>
            <p className="mt-1 font-display text-xl font-bold text-ink">{money(summary?.wallet_buckets?.[bucket])}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-hairline bg-paper">
          <div className="border-b border-hairline p-4 sm:p-5">
            <h3 className="font-display text-lg font-semibold text-ink">Payout queue</h3>
            <p className="mt-1 text-xs text-ink-soft">Recipient, amount and provider state · newest first</p>
          </div>
          {queueLoading && !payouts.length ? <p className="p-6 text-sm text-ink-soft">Loading payout records…</p> : !payouts.length ? <p className="p-6 text-sm text-ink-soft">No payout records yet.</p> : (
            <div className="divide-y divide-hairline">
              {payouts.map(item => (
                <article key={item.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-ink">{item.profiles?.full_name || item.payout_type} · {money(item.amount_kobo)}</p>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${item.status === 'failed' || item.status === 'on_hold' ? 'bg-danger/10 text-danger' : 'bg-sand text-ink-soft'}`}>{item.status.replace(/_/g,' ')}</span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-ink-soft">{item.provider_reference || item.id}</p>
                  {item.last_error_message && <p className="mt-1 text-xs text-danger">{item.last_error_message}</p>}
                  <p className="mt-1 text-[10px] text-ink-soft">{new Date(item.created_at).toLocaleString('en-NG')}</p>
                </article>
              ))}
            </div>
          )}
          {payoutHasMore && <div className="border-t border-hairline p-3 text-center"><button type="button" disabled={queueLoading} onClick={loadMorePayouts} className="text-sm font-semibold text-pepper disabled:opacity-50">Load older payouts</button></div>}
        </section>

        <section className="overflow-hidden rounded-2xl border border-hairline bg-paper">
          <div className="border-b border-hairline p-4 sm:p-5">
            <h3 className="font-display text-lg font-semibold text-ink">Paystack event inbox</h3>
            <p className="mt-1 text-xs text-ink-soft">Webhook delivery and retry history · newest first</p>
          </div>
          {queueLoading && !events.length ? <p className="p-6 text-sm text-ink-soft">Loading provider events…</p> : !events.length ? <p className="p-6 text-sm text-ink-soft">No provider events recorded yet.</p> : (
            <div className="divide-y divide-hairline">
              {events.map(item => (
                <article key={item.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-ink">{item.event_type}</p>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${item.state === 'failed' ? 'bg-danger/10 text-danger' : 'bg-sand text-ink-soft'}`}>{item.state}</span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-ink-soft">{item.provider_reference || item.id}</p>
                  <p className="mt-1 text-[10px] text-ink-soft">Attempts: {item.attempt_count} · {new Date(item.received_at).toLocaleString('en-NG')}</p>
                  {item.last_error_message && <p className="mt-1 text-xs text-danger">{item.last_error_message}</p>}
                </article>
              ))}
            </div>
          )}
          {eventHasMore && <div className="border-t border-hairline p-3 text-center"><button type="button" disabled={queueLoading} onClick={loadMoreEvents} className="text-sm font-semibold text-pepper disabled:opacity-50">Load older events</button></div>}
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-hairline bg-paper">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline p-4 sm:p-5">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">Financial journal history</h3>
            <p className="mt-1 text-xs text-ink-soft">Newest first · 25 records per request · cursor pagination</p>
          </div>
          <span className="rounded-full border border-hairline px-3 py-1 text-xs font-medium text-ink-soft">NGN · Read only</span>
        </div>
        {loading ? <div role="status" className="p-8 text-center text-sm text-ink-soft">Loading financial records…</div> : !journals.length ? (
          <div className="p-9 text-center">
            <Icon name="receipt" size={28} className="mx-auto text-ink-soft"/>
            <p className="mt-3 font-semibold text-ink">No posted journals yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-ink-soft">No new customer payments have been posted to the ledger yet. Historic orders are not automatically backfilled into wallet balances.</p>
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {journals.map(journal => (
              <article key={journal.id} className="grid gap-2 px-4 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(120px,0.7fr)_150px] sm:items-center sm:gap-4 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{journal.description || journal.source_type.replace(/_/g,' ')}</p>
                  <p className="mt-1 truncate font-mono text-[11px] text-ink-soft">{journal.source_type} · {journal.source_id || journal.id.slice(0,8)}</p>
                </div>
                <div><p className="text-sm font-semibold text-ink">{money(journal.debit_total_kobo)}</p><p className="text-[11px] text-ink-soft">{journal.line_count} ledger lines</p></div>
                <time className="text-xs text-ink-soft">{new Date(journal.created_at).toLocaleString('en-NG')}</time>
              </article>
            ))}
          </div>
        )}
        {hasMore && <div className="border-t border-hairline p-4 text-center"><button type="button" disabled={loadingMore} onClick={() => loadJournals(cursor,true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-hairline px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60">{loadingMore ? 'Loading…' : 'Load older records'} <Icon name="chevron-down" size={16}/></button></div>}
      </section>
    </section>
  );
}
