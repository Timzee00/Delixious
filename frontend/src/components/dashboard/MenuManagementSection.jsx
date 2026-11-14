import { useEffect, useState } from 'react';
import api from '../../lib/api.js';
import { formatNaira } from '../../lib/format.js';
import ConfirmModal from '../ConfirmModal.jsx';
import Modal from '../Modal.jsx';
import FormField from '../FormField.jsx';
import ImagePicker from '../ImagePicker.jsx';
import Img from '../Img.jsx';
import Icon from '../ui/Icon.jsx';
import { SearchField, Button } from '../ui/Primitives.jsx';
import { EmptyState } from '../StateViews.jsx';
import PaginationControls from '../ui/PaginationControls.jsx';

const CATEGORIES = ['Starters', 'Main', 'Sides', 'Drinks', 'Desserts', 'Other'];
const PAGE_SIZE = 30;

export default function MenuManagementSection({ restaurant }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState('all');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api.get(`/restaurants/${restaurant.id}/menu-management`, {
      params: {
        page, limit: PAGE_SIZE,
        ...(debouncedQuery ? { q: debouncedQuery } : {}),
        ...(category ? { category } : {}),
        availability,
      },
      signal: controller.signal,
    }).then(({ data }) => {
      if (cancelled) return;
      setItems(data.menu_items || []);
      setTotal(data.total || 0);
    }).catch(err => {
      if (!cancelled && err.code !== 'ERR_CANCELED') {
        setError(err.response?.data?.error || 'Could not load your menu.');
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; controller.abort(); };
  }, [restaurant.id, page, debouncedQuery, category, availability, retry]);

  async function toggleAvailability(item) {
    setBusyId(item.id);
    setError('');
    setNotice('');
    try {
      const { data } = await api.patch(`/menu-items/${item.id}/toggle-availability`);
      if (availability === 'available' && !data.menu_item.is_available || availability === 'unavailable' && data.menu_item.is_available) {
        setItems(current => current.filter(row => row.id !== item.id));
        setTotal(value => Math.max(0, value - 1));
      } else {
        setItems(current => current.map(row => row.id === item.id ? data.menu_item : row));
      }
      setNotice(data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update item availability.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!deletingItem) return;
    setBusyId(deletingItem.id);
    setError('');
    try {
      await api.delete(`/menu-items/${deletingItem.id}`);
      const remaining = items.filter(item => item.id !== deletingItem.id);
      setItems(remaining);
      setTotal(value => Math.max(0, value - 1));
      if (!remaining.length && page > 1) setPage(value => value - 1);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete this menu item.');
    } finally {
      setBusyId(null);
      setDeletingItem(null);
    }
  }

  function handleSaved(saved) {
    setShowForm(false);
    setEditingItem(null);
    setNotice(saved.id ? 'Menu item saved.' : 'Menu item saved.');
    setRetry(value => value + 1);
    if (!editingItem) {
      setPage(1);
      setQuery(saved.name || '');
    }
  }

  function clearFilters() {
    setQuery('');
    setCategory('');
    setAvailability('all');
    setPage(1);
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">CATALOGUE</p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">Menu management</h2>
          <p className="mt-1 text-sm text-ink-soft">Update dishes, prices and availability. Only this page of menu items is loaded.</p>
        </div>
        <Button onClick={() => { setEditingItem(null); setShowForm(true); }}>
          <Icon name="plus" size={17}/> Add dish
        </Button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-hairline bg-paper p-4 sm:grid-cols-[minmax(0,1fr)_180px_170px] sm:items-end">
        <SearchField id="menu-management-search" value={query} onChange={value => { setQuery(value); setPage(1); }} label="Search menu items" placeholder="Search dish names…" />
        <label className="block text-xs font-semibold text-ink-soft">Category
          <select value={category} onChange={event => { setCategory(event.target.value); setPage(1); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm font-medium text-ink">
            <option value="">All categories</option>
            {CATEGORIES.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-ink-soft">Availability
          <select value={availability} onChange={event => { setAvailability(event.target.value); setPage(1); }} className="mt-1.5 min-h-11 w-full rounded-xl border border-hairline bg-paper px-3 text-sm font-medium text-ink">
            <option value="all">All dishes</option>
            <option value="available">Available</option>
            <option value="unavailable">Sold out</option>
          </select>
        </label>
      </div>

      {error && <div role="alert" className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error} <button type="button" onClick={() => setRetry(value => value + 1)} className="ml-2 font-semibold underline">Retry</button></div>}
      {notice && <p role="status" className="rounded-xl border border-jade/20 bg-jade-soft px-4 py-3 text-sm text-jade">{notice}</p>}

      <div className="overflow-hidden rounded-2xl border border-hairline bg-paper">
        <div className="hidden grid-cols-[minmax(0,1fr)_130px_130px_180px] gap-4 border-b border-hairline bg-sand/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink-soft sm:grid">
          <span>Dish</span><span>Price</span><span>Status</span><span className="text-right">Actions</span>
        </div>
        {loading ? (
          <div className="space-y-3 p-5" aria-label="Loading menu items" role="status">
            {[1, 2, 3, 4].map(item => <div key={item} className="flex items-center gap-3 animate-pulse"><div className="h-12 w-12 rounded-xl bg-hairline"/><div className="flex-1"><div className="h-3 w-1/3 rounded bg-hairline"/><div className="mt-2 h-2 w-1/5 rounded bg-hairline"/></div></div>)}
          </div>
        ) : !items.length ? (
          <div className="p-4 sm:p-8">
            <EmptyState illustration="kitchen" title={total === 0 && !debouncedQuery && !category && availability === 'all' ? 'Your menu is ready to be filled' : 'No dishes match these filters'}
              message={total === 0 && !debouncedQuery && !category && availability === 'all' ? 'Add your first dish so customers can see what your kitchen makes.' : 'Try a different search or clear the filters.'}
              action={<Button variant="secondary" onClick={total === 0 && !debouncedQuery && !category && availability === 'all' ? () => setShowForm(true) : clearFilters}>{total === 0 && !debouncedQuery && !category && availability === 'all' ? 'Add your first dish' : 'Clear filters'}</Button>}
            />
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {items.map(item => (
              <article key={item.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_130px_130px_180px] sm:items-center sm:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Img src={item.image_url} alt={item.name} fallbackText={item.name?.[0]} frameClassName="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-sand"/>
                  <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-ink">{item.name}</h3><p className="mt-0.5 truncate text-xs text-ink-soft">{item.category || 'Uncategorized'}{item.description ? ` · ${item.description}` : ''}</p></div>
                </div>
                <p className="font-mono text-sm font-semibold text-ink">{formatNaira(item.price)}</p>
                <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${item.is_available ? 'bg-jade-soft text-jade' : 'bg-sand text-ink-soft'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${item.is_available ? 'bg-jade' : 'bg-ink-soft'}`}/>{item.is_available ? 'Available' : 'Sold out'}
                </span>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button type="button" disabled={busyId === item.id} onClick={() => toggleAvailability(item)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-hairline px-3 text-xs font-semibold text-ink-soft hover:border-pepper hover:text-pepper disabled:opacity-50">
                    <Icon name={item.is_available ? 'circle-alert' : 'circle-check'} size={15}/>{item.is_available ? 'Mark sold out' : 'Make available'}
                  </button>
                  <button type="button" disabled={busyId === item.id} onClick={() => { setEditingItem(item); setShowForm(true); }} aria-label={`Edit ${item.name}`} className="grid min-h-10 min-w-10 place-items-center rounded-lg border border-hairline text-ink-soft hover:text-pepper disabled:opacity-50">
                    <Icon name="pencil" size={16}/>
                  </button>
                  <button type="button" disabled={busyId === item.id} onClick={() => setDeletingItem(item)} aria-label={`Delete ${item.name}`} className="grid min-h-10 min-w-10 place-items-center rounded-lg border border-hairline text-ink-soft hover:border-danger hover:text-danger disabled:opacity-50">
                    <Icon name="trash-2" size={16}/>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {!loading && <PaginationControls page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage}/>}
      {showForm && <MenuItemForm restaurantId={restaurant.id} item={editingItem} onSaved={handleSaved} onCancel={() => { setShowForm(false); setEditingItem(null); }} />}
      {deletingItem && <ConfirmModal title="Delete this dish?" message={`“${deletingItem.name}” will be removed from your menu.`} confirmLabel="Delete dish" onCancel={() => setDeletingItem(null)} onConfirm={handleDelete} />}
    </section>
  );
}

function MenuItemForm({ restaurantId, item, onSaved, onCancel }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState({ name: item?.name || '', description: item?.description || '', price: item?.price ?? '', category: item?.category || CATEGORIES[1], image_url: item?.image_url || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || form.price === '' || Number(form.price) < 0 || !Number.isFinite(Number(form.price))) { setError('Enter a dish name and a valid non-negative price.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, price: Number(form.price) };
      const { data } = isEdit ? await api.put(`/menu-items/${item.id}`, payload) : await api.post(`/restaurants/${restaurantId}/menu`, payload);
      onSaved(data.menu_item);
    } catch (err) { setError(err.response?.data?.error || 'Could not save this dish.'); }
    finally { setSaving(false); }
  }

  return (
    <Modal onClose={onCancel} labelledBy="menu-item-form-title" className="max-h-[90vh] max-w-md overflow-y-auto">
      <form onSubmit={handleSubmit}>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pepper">{isEdit ? 'UPDATE YOUR CATALOGUE' : 'ADD TO YOUR CATALOGUE'}</p>
        <h3 id="menu-item-form-title" className="mt-1 font-display text-xl font-bold text-ink">{isEdit ? 'Edit dish' : 'Add a dish'}</h3>
        <div className="mt-4 space-y-3">
          <ImagePicker label="Dish image" url={form.image_url} category="menu" onUploaded={url => setForm(current => ({ ...current, image_url: url }))} size="h-36 w-full"/>
          <FormField label="Dish name" value={form.name} onChange={value => setForm(current => ({ ...current, name: value }))} required />
          <FormField label="Price (₦)" type="number" value={form.price} onChange={value => setForm(current => ({ ...current, price: value }))} required />
          <label className="block text-sm font-medium text-ink">Category
            <select value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))} className="mt-1 w-full rounded-xl border border-hairline bg-paper px-3 py-3 text-ink">
              {CATEGORIES.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <FormField label="Description" as="textarea" rows={3} value={form.description} onChange={value => setForm(current => ({ ...current, description: value }))} />
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" busy={saving}> {isEdit ? 'Save changes' : 'Add dish'}</Button>
        </div>
      </form>
    </Modal>
  );
}
