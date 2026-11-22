-- Delixious financial operations controls: provider event inbox, payout queue,
-- reconciliation runs and a bounded admin summary. No transfers are enabled here.

create table if not exists public.financial_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('paystack')),
  event_key text not null,
  event_type text not null,
  provider_reference text,
  payload_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  state text not null default 'received' check (state in ('received','processing','processed','failed','ignored')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  last_error_message text,
  received_at timestamptz not null default now(),
  processing_started_at timestamptz,
  processed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(provider,event_key)
);
create index if not exists financial_provider_events_queue_idx
  on public.financial_provider_events(state,received_at,id);
create index if not exists financial_provider_events_reference_idx
  on public.financial_provider_events(provider,provider_reference,received_at desc);

create table if not exists public.financial_payouts (
  id uuid primary key default gen_random_uuid(),
  wallet_account_id uuid not null references public.wallet_accounts(id) on delete restrict,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  payout_type text not null check (payout_type in ('restaurant','rider')),
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'queued' check (status in ('queued','on_hold','approved','processing','paid','failed','reversed','cancelled')),
  beneficiary_token text not null,
  account_last4 text check (account_last4 is null or account_last4 ~ '^[0-9]{4}$'),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 200),
  provider_reference text unique,
  provider_transfer_code text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  last_error_code text,
  last_error_message text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists financial_payouts_queue_idx
  on public.financial_payouts(status,next_attempt_at,created_at,id);
create index if not exists financial_payouts_owner_history_idx
  on public.financial_payouts(owner_user_id,created_at desc,id desc);
create index if not exists financial_payouts_wallet_history_idx
  on public.financial_payouts(wallet_account_id,created_at desc,id desc);

create table if not exists public.financial_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('paystack')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  state text not null default 'queued' check (state in ('queued','running','completed','failed')),
  provider_gross_kobo bigint,
  provider_fees_kobo bigint,
  provider_net_kobo bigint,
  local_gross_kobo bigint,
  unmatched_provider_items integer not null default 0 check (unmatched_provider_items >= 0),
  unmatched_local_items integer not null default 0 check (unmatched_local_items >= 0),
  notes text,
  initiated_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reconciliation_period_valid check (period_end > period_start),
  unique(provider,period_start,period_end)
);
create index if not exists financial_reconciliation_history_idx
  on public.financial_reconciliation_runs(created_at desc,id desc);

create or replace function public.get_financial_admin_summary(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer := greatest(1,least(coalesce(p_days,30),365));
  v_total_journals bigint;
  v_recent_journals bigint;
  v_debits bigint;
  v_credits bigint;
  v_unbalanced bigint;
  v_latest timestamptz;
  v_system_accounts jsonb;
  v_wallet_buckets jsonb;
  v_payout_queue jsonb;
  v_event_queue jsonb;
begin
  select count(*),count(*) filter (where created_at >= now() - make_interval(days => v_days)),max(created_at)
    into v_total_journals,v_recent_journals,v_latest
  from public.financial_journals;

  select coalesce(sum(l.amount_kobo) filter (where l.side = 'debit'),0)::bigint,
         coalesce(sum(l.amount_kobo) filter (where l.side = 'credit'),0)::bigint
    into v_debits,v_credits
  from public.financial_journal_lines l
  join public.financial_journals j on j.id = l.journal_id
  where j.created_at >= now() - make_interval(days => v_days);

  select count(*) into v_unbalanced
  from (
    select journal_id
    from public.financial_journal_lines
    group by journal_id
    having sum(case when side = 'debit' then amount_kobo else 0 end)
        <> sum(case when side = 'credit' then amount_kobo else 0 end)
  ) unbalanced;

  select coalesce(jsonb_agg(jsonb_build_object(
    'account_code',q.account_code,'account_name',q.account_name,'account_type',q.account_type,'balance_kobo',q.balance_kobo
  ) order by q.account_code),'[]'::jsonb)
  into v_system_accounts
  from (
    select a.account_code,a.account_name,a.account_type,
      coalesce(sum(case when l.side = a.normal_side then l.amount_kobo else -l.amount_kobo end),0)::bigint as balance_kobo
    from public.financial_accounts a
    left join public.financial_journal_lines l on l.account_id = a.id
    where a.wallet_account_id is null
    group by a.id,a.account_code,a.account_name,a.account_type,a.normal_side
  ) q;

  select coalesce(jsonb_object_agg(wallet_bucket,balance_kobo),'{}'::jsonb)
  into v_wallet_buckets
  from (
    select wallet_bucket,coalesce(sum(balance_kobo),0)::bigint as balance_kobo
    from public.wallet_account_ledger_balances
    group by wallet_bucket
  ) buckets;

  select jsonb_build_object(
    'queued',count(*) filter (where status = 'queued'),
    'on_hold',count(*) filter (where status = 'on_hold'),
    'processing',count(*) filter (where status = 'processing'),
    'failed',count(*) filter (where status = 'failed'),
    'reversed',count(*) filter (where status = 'reversed')
  ) into v_payout_queue from public.financial_payouts;

  select jsonb_build_object(
    'received',count(*) filter (where state = 'received'),
    'processing',count(*) filter (where state = 'processing'),
    'failed',count(*) filter (where state = 'failed')
  ) into v_event_queue from public.financial_provider_events;

  return jsonb_build_object(
    'currency','NGN',
    'period_days',v_days,
    'total_journals',v_total_journals,
    'recent_journals',v_recent_journals,
    'recent_debits_kobo',v_debits,
    'recent_credits_kobo',v_credits,
    'unbalanced_journals',v_unbalanced,
    'latest_journal_at',v_latest,
    'system_accounts',v_system_accounts,
    'wallet_buckets',v_wallet_buckets,
    'payout_queue',coalesce(v_payout_queue,'{}'::jsonb),
    'provider_event_queue',coalesce(v_event_queue,'{}'::jsonb)
  );
end;
$$;
revoke all on function public.get_financial_admin_summary(integer) from public,anon,authenticated;
grant execute on function public.get_financial_admin_summary(integer) to service_role;

alter table public.financial_provider_events enable row level security;
alter table public.financial_payouts enable row level security;
alter table public.financial_reconciliation_runs enable row level security;
revoke all on public.financial_provider_events,public.financial_payouts,public.financial_reconciliation_runs from anon,authenticated;
