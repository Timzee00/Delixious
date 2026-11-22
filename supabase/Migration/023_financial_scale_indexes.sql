-- Cover high-volume history/queue access patterns and new foreign keys.
create index if not exists financial_journals_created_id_idx
  on public.financial_journals(created_at desc,id desc);
create index if not exists financial_journal_lines_account_created_id_idx
  on public.financial_journal_lines(account_id,created_at desc,id desc);
create index if not exists financial_payouts_created_id_idx
  on public.financial_payouts(created_at desc,id desc);
create index if not exists financial_payouts_approved_by_idx
  on public.financial_payouts(approved_by) where approved_by is not null;
create index if not exists financial_provider_events_received_id_idx
  on public.financial_provider_events(received_at desc,id desc);
create index if not exists financial_reconciliation_runs_initiated_by_idx
  on public.financial_reconciliation_runs(initiated_by) where initiated_by is not null;
