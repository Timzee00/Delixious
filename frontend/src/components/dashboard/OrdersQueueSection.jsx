import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api.js';
import { formatNaira } from '../../lib/format.js';
import Modal from '../Modal.jsx';
import Icon from '../ui/Icon.jsx';
import SceneIllustration from '../ui/SceneIllustration.jsx';
import PaginationControls from '../ui/PaginationControls.jsx';
import { Button } from '../ui/Primitives.jsx';

const PAGE_SIZE = 20;
const FILTERS = [
  { id: 'active', label: 'Active orders', statuses: 'pending,confirmed,preparing,out_for_delivery' },
  { id: 'pending', label: 'Awaiting review', statuses: 'pending' },
  { id: 'preparing', label: 'In kitchen', statuses: 'confirmed,preparing' },
  { id: 'delivered', label: 'Completed', statuses: 'delivered' },
  { id: 'cancelled', label: 'Cancelled', statuses: 'cancelled' },
  { id: 'all', label: 'All orders', statuses: '' },
];

const NEXT_STATUS = { confirmed: 'preparing' };
const NEXT_LABEL = { confirmed: 'Start preparing' };
const STATUS_STYLES = {
  pending: 'bg-gold/15 text-[#8A5A00]',
  confirmed: 'bg-[#FFF2D8] text-[#8A5A00]',
  preparing: 'bg-[#FFF2D8] text-[#8A5A00]',
  out_for_delivery: 'bg-pepper/10 text-pepper',
  delivered: 'bg-jade-soft text-jade',
  cancelled: 'bg-sand text-ink-soft',
};

export default function OrdersQueueSection({ restaurant }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('active');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [assigningOrder, setAssigningOrder] = useState(null);

  const load = useCallback(async (pageToLoad = 1, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    const selected = FILTERS.find(item => item.id === filter) || FILTERS[0];
    try {
      const { data } = await api.get(`/restaurants/${restaurant.id}/orders`, {
        params: { page: pageToLoad, limit: PAGE_SIZE, ...(selected.statuses ? { statuses: selected.statuses } : {}) },
      });
      setOrders(current => append ? [...current, ...(data.orders || [])] : (data.orders || []));
      setTotal(data.total || 0);
      setPage(pageToLoad);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load orders.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [restaurant.id, filter]);

  useEffect(() => {
    setOrders([]);
    setPage(1);
    load(1);
    const interval = window.setInterval(() => load(1), 25000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function advanceStatus(order) {
    const nextStatus = NEXT_STATUS[order.status];
    if (!nextStatus || busyId) return;
    setBusyId(order.id);
    setError('');
    try {
      const { data } = await api.patch(`/orders/${order.id}/status`, { status: nextStatus });
      setOrders(current => current.map(item => item.id === order.id ? { ...item, ...data.order } : item));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update order status.');
    } finally {
      setBusyId(null);
    }
  }

  const activeOrders = orders.filter(order => !['delivered', 'cancelled'].includes(order.status));
  const pastOrders = orders.filter(order => ['delivered', 'cancelled'].includes(order.status));
  const selectedFilter = FILTERS.find(item => item.id === filter) || FILTERS[0];

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">SERVICE QUEUE</p><h2 className="mt-1 font-display text-2xl font-bold text-ink">Orders</h2><p className="mt-1 text-sm text-ink-soft">Review paid orders and move each order into preparation.</p></div>
        <Button variant="secondary" onClick={() => load(1)}><Icon name="refresh" size={16}/> Refresh queue</Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter restaurant orders">
        {FILTERS.map(item => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} onClick={() => { setFilter(item.id); setPage(1); }}
          className={`min-h-10 shrink-0 rounded-xl px-3 text-xs font-semibold transition-colors ${filter === item.id ? 'bg-pepper text-white' : 'border border-hairline bg-paper text-ink-soft hover:text-ink'}`}>
          {item.label}
        </button>)}
      </div>

      {error && <p role="alert" aria-live="polite" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {loading ? <div className="space-y-3" role="status" aria-label="Loading restaurant orders">{[1,2,3].map(value => <div key={value} className="h-28 animate-pulse rounded-2xl bg-hairline"/>)}</div> : !orders.length ? (
        <div className="rounded-2xl border border-hairline bg-paper p-6 sm:p-8"><SceneIllustration scene="orders" className="mx-auto h-28 w-40"/><h3 className="mt-2 text-center font-display text-lg font-bold text-ink">{filter === 'active' ? 'Your queue is clear' : 'No orders in this view'}</h3><p className="mt-1 text-center text-sm text-ink-soft">{filter === 'active' ? 'New paid orders will appear here when customers check out.' : 'Try another order filter to see more records.'}</p></div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const canPrepare = NEXT_STATUS[order.status] === 'preparing';
            const isActive = !['delivered', 'cancelled'].includes(order.status);
            return (
              <article key={order.id} className="rounded-2xl border border-hairline bg-paper p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-mono text-[11px] text-ink-soft">ORDER #{order.id.slice(0,8)}</p><p className="mt-1 font-semibold text-ink">{new Date(order.created_at).toLocaleString()}</p></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[order.status] || 'bg-sand text-ink-soft'}`}>{order.status.replace(/_/g,' ')}</span>
                </div>
                <div className="mt-4 divide-y divide-hairline">
                  {(order.order_items || []).map(item => <div key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0"><span className="min-w-0 truncate text-ink">{item.quantity} × {item.name_snapshot}</span><span className="shrink-0 font-mono text-xs text-ink-soft">{formatNaira(item.subtotal)}</span></div>)}
                </div>
                <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-hairline pt-3">
                  <div className="min-w-0"><p className="text-xs text-ink-soft">Delivery address</p><p className="mt-1 max-w-xl text-sm text-ink">{order.delivery_address || 'Not supplied'}</p><p className="mt-2 font-mono text-sm font-bold text-ink">{formatNaira(order.total_amount)}</p></div>
                  <div className="flex flex-wrap gap-2">
                    {['confirmed','preparing'].includes(order.status) && <button type="button" onClick={() => setAssigningOrder(order)} className="min-h-10 rounded-xl border border-hairline px-3 text-xs font-semibold text-ink hover:border-pepper hover:text-pepper"><Icon name="bike" size={15} className="mr-1 inline"/>Assign rider</button>}
                    {canPrepare && <Button busy={busyId === order.id} onClick={() => advanceStatus(order)}>Start preparing</Button>}
                    {order.status === 'preparing' && <span className="inline-flex min-h-10 items-center rounded-xl bg-sand px-3 text-xs font-semibold text-ink-soft">Awaiting rider pickup</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && <PaginationControls page={page} total={total} pageSize={PAGE_SIZE} onPageChange={nextPage => load(nextPage)}/>}
      {assigningOrder && <AssignAgentModal order={assigningOrder} onDone={() => { setAssigningOrder(null); load(1); }}/>}
    </section>
  );
}

function AssignAgentModal({ order, onDone }) {
  const [phone, setPhone] = useState('');
  const [agents, setAgents] = useState([]);
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assigned, setAssigned] = useState(null);
  const [error, setError] = useState('');

  async function handleSearch(e) {
    e.preventDefault();
    if (phone.trim().length < 3) {
      setError('Enter at least 3 digits of their phone number.');
      return;
    }
    setSearching(true);
    setError('');
    try {
      const { data } = await api.get('/delivery/agents/search', { params: { phone: phone.trim() } });
      setAgents(data.agents);
      if (!data.agents.length) setError('No delivery agent found with that number.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not search for agents.');
    } finally {
      setSearching(false);
    }
  }

  async function handleAssign(agent) {
    setAssigning(true);
    setError('');
    try {
      await api.patch(`/delivery/${order.id}/assign-agent`, { delivery_agent_id: agent.id });
      setAssigned(agent);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not assign this agent.');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <Modal onClose={onDone} labelledBy="assign-agent-title">
      <h3 id="assign-agent-title" className="font-display text-lg font-bold text-ink">
        Assign a delivery rider
      </h3>

      {assigned ? (
        <>
          <p role="status" aria-live="polite" className="mt-3 rounded-lg bg-jade-soft px-3 py-2 text-sm text-jade">
            {assigned.full_name} has been assigned to order #{order.id.slice(0, 8)}.
          </p>
          <button
            onClick={onDone}
            className="mt-4 w-full rounded-lg bg-pepper py-2 text-sm font-semibold text-white transition-colors hover:bg-pepper-dark"
          >
            Done
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-soft">Search by the rider's phone number.</p>

          <form onSubmit={handleSearch} className="mt-4 flex gap-2">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="080..."
              className="flex-1 rounded-lg border border-hairline bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:border-pepper"
            />
            <button
              type="submit"
              disabled={searching}
              className="rounded-lg bg-pepper px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-pepper-dark disabled:opacity-60"
            >
              {searching ? '...' : 'Search'}
            </button>
          </form>

          {error && (
            <p role="alert" aria-live="polite" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {agents.length > 0 && (
            <div className="mt-4 space-y-2">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-ink">{agent.full_name}</p>
                    <p className="text-xs text-ink-soft">{agent.phone}</p>
                  </div>
                  <button
                    onClick={() => handleAssign(agent)}
                    disabled={assigning}
                    className="rounded-lg bg-jade px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-jade/90 disabled:opacity-60"
                  >
                    {assigning ? '...' : 'Assign'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={onDone}
            className="mt-4 w-full rounded-lg border border-hairline py-2 text-sm font-medium text-ink-soft transition-colors hover:border-ink-soft"
          >
            Close
          </button>
        </>
      )}
    </Modal>
  );
}
