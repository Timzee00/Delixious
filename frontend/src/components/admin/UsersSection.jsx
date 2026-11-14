import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/adminApi.js';
import PaginationControls from '../ui/PaginationControls.jsx';

const ROLES = ['', 'customer', 'restaurant_owner', 'delivery_agent', 'admin'];
const PAGE_SIZE = 20;

export default function UsersSection() {
  const [users, setUsers] = useState([]);
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    adminApi.listUsers({ role: role || undefined, page, limit: PAGE_SIZE })
      .then(({ data }) => {
        if (cancelled) return;
        setUsers(data.users || []);
        setTotal(data.total || 0);
      })
      .catch(err => { if (!cancelled) setError(err.response?.data?.error || 'Could not load users.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [role, page]);

  async function toggleSuspend(id, current) {
    setBusyId(id);
    setError('');
    try {
      await adminApi.setUserSuspension(id, !current);
      setUsers(users => users.map(u => u.id === id ? { ...u, is_suspended: !current } : u));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update user.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-xl font-bold text-ink">Marketplace accounts</h2><p className="mt-1 text-sm text-ink-soft">Find and manage accounts by role.</p></div>
        <label className="text-xs font-semibold text-ink-soft">Role
          <select value={role} onChange={e => { setRole(e.target.value); setPage(1); }} className="ml-2 min-h-10 rounded-lg border border-hairline bg-paper px-3 text-sm font-medium text-ink">
            {ROLES.map(r => <option key={r || 'all'} value={r}>{r ? r.replace(/_/g, ' ') : 'All roles'}</option>)}
          </select>
        </label>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {loading ? <p className="mt-6 text-sm text-ink-soft">Loading accounts…</p> : !users.length ? (
        <div className="mt-6 rounded-xl border border-hairline bg-paper p-8 text-center text-sm text-ink-soft">No accounts found.</div>
      ) : (
        <div className="mt-5 space-y-2">
          {users.map(u => (
            <article key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-paper p-4">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{u.full_name || 'Unnamed account'} <span className="ml-1 text-xs font-normal capitalize text-ink-soft">{u.role?.replace(/_/g, ' ')}</span></p>
                <p className="mt-1 truncate text-sm text-ink-soft">{u.email || 'No email'}{u.phone ? ` · ${u.phone}` : ''}</p>
              </div>
              <button type="button" disabled={busyId === u.id} onClick={() => toggleSuspend(u.id, u.is_suspended)}
                className={`min-h-10 rounded-lg px-3 text-sm font-semibold disabled:opacity-50 ${u.is_suspended ? 'bg-jade text-white' : 'border border-hairline text-danger'}`}>
                {busyId === u.id ? 'Saving…' : u.is_suspended ? 'Restore access' : 'Suspend account'}
              </button>
            </article>
          ))}
        </div>
      )}
      {!loading && <PaginationControls page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage}/>}
    </section>
  );
}
