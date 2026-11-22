-- Delixious financial ledger v1: append-only, balanced, idempotent journal posting.
-- This migration creates accounting infrastructure only. It does not enable customer
-- stored-value funding, wallet checkout, or live withdrawals.

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  account_code text not null unique,
  account_name text not null,
  account_type text not null check (account_type in ('asset','liability','equity','revenue','expense')),
  normal_side text not null check (normal_side in ('debit','credit')),
  wallet_account_id uuid references public.wallet_accounts(id) on delete restrict,
  wallet_bucket text check (wallet_bucket is null or wallet_bucket in ('available','pending','held')),
  currency text not null default 'NGN' check (currency = 'NGN'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint financial_account_wallet_bucket_pair check (
    (wallet_account_id is null and wallet_bucket is null)
    or (wallet_account_id is not null and wallet_bucket is not null)
  ),
  constraint financial_account_wallet_bucket_unique unique(wallet_account_id, wallet_bucket)
);

create table if not exists public.financial_journals (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 200),
  payload_hash text not null,
  source_type text not null check (char_length(source_type) between 2 and 80),
  source_id text,
  description text not null default '',
  currency text not null default 'NGN' check (currency = 'NGN'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.financial_journals(id) on delete restrict,
  account_id uuid not null references public.financial_accounts(id) on delete restrict,
  side text not null check (side in ('debit','credit')),
  amount_kobo bigint not null check (amount_kobo > 0),
  created_at timestamptz not null default now()
);

create index if not exists financial_journals_source_idx
  on public.financial_journals(source_type, source_id, created_at desc);
create index if not exists financial_journal_lines_account_idx
  on public.financial_journal_lines(account_id, created_at desc);
create index if not exists financial_journal_lines_journal_idx
  on public.financial_journal_lines(journal_id);

-- System control accounts. Wallet-specific accounts are created below.
insert into public.financial_accounts(account_code,account_name,account_type,normal_side) values
  ('SYS:PAYSTACK_CLEARING','Paystack clearing','asset','debit'),
  ('SYS:BANK_SETTLEMENT','Bank settlement','asset','debit'),
  ('SYS:RESTAURANT_PAYABLE','Restaurant payable control','liability','credit'),
  ('SYS:RIDER_PAYABLE','Rider payable control','liability','credit'),
  ('SYS:CUSTOMER_REFUNDS_PAYABLE','Customer refunds payable','liability','credit'),
  ('SYS:CHARGEBACKS_PAYABLE','Chargebacks payable','liability','credit'),
  ('SYS:PLATFORM_COMMISSION_REVENUE','Platform commission revenue','revenue','credit'),
  ('SYS:PLATFORM_SERVICE_FEE_REVENUE','Platform service-fee revenue','revenue','credit'),
  ('SYS:PAYSTACK_PROCESSING_EXPENSE','Payment processing expense','expense','debit'),
  ('SYS:REFUND_ADJUSTMENTS','Refund and dispute adjustments','expense','debit')
on conflict(account_code) do nothing;

-- Each wallet has three independently calculated liability buckets. Balances are
-- derived from immutable journal lines; the old mutable balance columns are not
-- treated as an accounting source of truth.
insert into public.financial_accounts(account_code,account_name,account_type,normal_side,wallet_account_id,wallet_bucket)
select
  'WALLET:' || wa.id::text || ':' || buckets.bucket,
  initcap(wa.kind) || ' wallet ' || buckets.bucket,
  'liability',
  'credit',
  wa.id,
  buckets.bucket
from public.wallet_accounts wa
cross join (values ('available'),('pending'),('held')) as buckets(bucket)
on conflict(account_code) do nothing;

create or replace function public.wallet_create_financial_accounts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.financial_accounts(
    account_code,account_name,account_type,normal_side,wallet_account_id,wallet_bucket
  )
  values
    ('WALLET:' || new.id::text || ':available', initcap(new.kind) || ' wallet available', 'liability', 'credit', new.id, 'available'),
    ('WALLET:' || new.id::text || ':pending', initcap(new.kind) || ' wallet pending', 'liability', 'credit', new.id, 'pending'),
    ('WALLET:' || new.id::text || ':held', initcap(new.kind) || ' wallet held', 'liability', 'credit', new.id, 'held')
  on conflict(account_code) do nothing;
  return new;
end;
$$;
revoke all on function public.wallet_create_financial_accounts() from public, anon, authenticated;
drop trigger if exists wallet_create_financial_accounts_insert on public.wallet_accounts;
create trigger wallet_create_financial_accounts_insert
after insert on public.wallet_accounts
for each row execute function public.wallet_create_financial_accounts();

create or replace function public.financial_prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Posted financial journals and lines are immutable; post a reversal instead';
end;
$$;
revoke all on function public.financial_prevent_mutation() from public, anon, authenticated;
drop trigger if exists financial_journals_immutable on public.financial_journals;
create trigger financial_journals_immutable
before update or delete on public.financial_journals
for each row execute function public.financial_prevent_mutation();
drop trigger if exists financial_journal_lines_immutable on public.financial_journal_lines;
create trigger financial_journal_lines_immutable
before update or delete on public.financial_journal_lines
for each row execute function public.financial_prevent_mutation();

-- The only application write path. A complete journal must balance in integer
-- kobo and all account codes must be active. Repeated idempotency keys return
-- the original journal only when the submitted payload is identical.
create or replace function public.post_financial_journal(
  p_idempotency_key text,
  p_source_type text,
  p_source_id text,
  p_description text,
  p_lines jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_journal_id uuid;
  v_payload_hash text;
  v_existing_hash text;
  v_line_count integer;
  v_debits numeric;
  v_credits numeric;
  v_unknown integer;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 or char_length(p_idempotency_key) > 200 then
    raise exception 'Invalid financial idempotency key';
  end if;
  if p_source_type is null or char_length(p_source_type) < 2 or char_length(p_source_type) > 80 then
    raise exception 'Invalid financial source type';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Financial journal lines must be a JSON array';
  end if;

  select count(*),
         coalesce(sum(case when x.side = 'debit' then x.amount_kobo else 0 end),0),
         coalesce(sum(case when x.side = 'credit' then x.amount_kobo else 0 end),0)
    into v_line_count, v_debits, v_credits
  from jsonb_to_recordset(p_lines) as x(account_code text, side text, amount_kobo bigint);

  if v_line_count < 2 then
    raise exception 'A financial journal requires at least two lines';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_lines) as x(account_code text, side text, amount_kobo bigint)
    where x.account_code is null or x.side is null or x.side not in ('debit','credit') or x.amount_kobo is null or x.amount_kobo <= 0
  ) then
    raise exception 'Financial journal contains an invalid line';
  end if;
  if v_debits <> v_credits then
    raise exception 'Financial journal is not balanced: debits %, credits %', v_debits, v_credits;
  end if;

  select count(*) into v_unknown
  from jsonb_to_recordset(p_lines) as x(account_code text, side text, amount_kobo bigint)
  left join public.financial_accounts a on a.account_code = x.account_code and a.is_active = true
  where a.id is null;
  if v_unknown > 0 then
    raise exception 'Financial journal references an unknown or inactive account';
  end if;

  v_payload_hash := md5(
    coalesce(p_source_type,'') || '|' ||
    coalesce(p_source_id,'') || '|' ||
    coalesce(p_description,'') || '|' ||
    p_lines::text || '|' ||
    coalesce(p_metadata,'{}'::jsonb)::text
  );

  insert into public.financial_journals(
    idempotency_key,payload_hash,source_type,source_id,description,metadata
  ) values (
    p_idempotency_key,v_payload_hash,p_source_type,p_source_id,coalesce(p_description,''),coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict(idempotency_key) do nothing
  returning id into v_journal_id;

  if v_journal_id is null then
    select id,payload_hash into v_journal_id,v_existing_hash
    from public.financial_journals
    where idempotency_key = p_idempotency_key
    for update;
    if v_existing_hash is distinct from v_payload_hash then
      raise exception 'Idempotency key was already used for a different financial journal';
    end if;
    return v_journal_id;
  end if;

  insert into public.financial_journal_lines(journal_id,account_id,side,amount_kobo)
  select v_journal_id,a.id,x.side,x.amount_kobo
  from jsonb_to_recordset(p_lines) as x(account_code text, side text, amount_kobo bigint)
  join public.financial_accounts a on a.account_code = x.account_code and a.is_active = true;

  return v_journal_id;
end;
$$;
revoke all on function public.post_financial_journal(text,text,text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.post_financial_journal(text,text,text,text,jsonb,jsonb) to service_role;

create or replace view public.wallet_account_ledger_balances
with (security_invoker = true)
as
select
  a.wallet_account_id,
  a.wallet_bucket,
  coalesce(sum(case when l.side = 'credit' then l.amount_kobo else -l.amount_kobo end),0)::bigint as balance_kobo
from public.financial_accounts a
left join public.financial_journal_lines l on l.account_id = a.id
where a.wallet_account_id is not null
group by a.wallet_account_id,a.wallet_bucket;

alter table public.financial_accounts enable row level security;
alter table public.financial_journals enable row level security;
alter table public.financial_journal_lines enable row level security;
revoke all on public.financial_accounts,public.financial_journals,public.financial_journal_lines from anon,authenticated;
revoke all on public.wallet_account_ledger_balances from anon,authenticated;
grant select on public.wallet_account_ledger_balances to service_role;
