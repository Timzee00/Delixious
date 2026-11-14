export default function PaginationControls({ page, total, pageSize, onPageChange, loading = false }) {
  const pages = Math.max(1, Math.ceil((total || 0) / pageSize));
  if (!total || pages <= 1) {
    return total ? <p className="text-xs text-ink-soft">Showing {Math.min(total, pageSize).toLocaleString()} of {total.toLocaleString()}</p> : null;
  }
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pagination" className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
      <p className="text-xs text-ink-soft">Showing {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}</p>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}
          className="min-h-10 rounded-lg border border-hairline px-3 text-sm font-semibold text-ink hover:border-pepper disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
        <span className="min-w-16 text-center text-xs tabular-nums text-ink-soft">Page {page} / {pages}</span>
        <button type="button" disabled={page >= pages || loading} onClick={() => onPageChange(page + 1)}
          className="min-h-10 rounded-lg border border-hairline px-3 text-sm font-semibold text-ink hover:border-pepper disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      </div>
    </nav>
  );
}
