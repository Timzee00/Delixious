-- Add recoverable processing leases for successful payment finalization.
alter table public.payments
  add column if not exists processing_started_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists payments_processing_lease_idx
  on public.payments(processing_started_at,id)
  where status = 'processing';
