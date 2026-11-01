-- Delixious Wallet foundation. Apply only after 008_production_consistency.sql.
-- Financial ledger infrastructure only: real-money funding, custody and
-- withdrawals require a licensed provider and separately audited integration.
-- Money values are INTEGER KOBO, never floating-point NGN.

create table if not exists public.wallet_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) on delete restrict,
  restaurant_id uuid references public.restaurants(id) on delete restrict,
  kind text not null check (kind in ('customer', 'restaurant', 'rider')),
  currency text not null default 'NGN' check (currency = 'NGN'),
  balance_kobo bigint not null default 0 check (balance_kobo >= 0),
  pending_kobo bigint not null default 0 check (pending_kobo >= 0),
  held_kobo bigint not null default 0 check (held_kobo >= 0),
  status text not null default 'active' check (status in ('active', 'frozen', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_account_owner_and_restaurant check (
    (kind = 'restaurant' and restaurant_id is not null and owner_user_id is not null)
    or (kind in ('customer', 'rider') and restaurant_id is null and owner_user_id is not null)
  )
);
create unique index if not exists wallet_accounts_restaurant_unique on public.wallet_accounts(restaurant_id) where restaurant_id is not null;
create unique index if not exists wallet_accounts_personal_unique on public.wallet_accounts(owner_user_id,kind) where restaurant_id is null;
create index if not exists wallet_accounts_owner_idx on public.wallet_accounts(owner_user_id);

create table if not exists public.wallet_verifications (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'unverified' check (status in ('unverified', 'pending', 'verified', 'rejected')),
  provider_reference text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_settings (
  id integer primary key default 1 check (id = 1),
  restaurant_commission_bps integer not null default 1000 check (restaurant_commission_bps between 0 and 3000),
  rider_commission_bps integer not null default 0 check (rider_commission_bps between 0 and 3000),
  restaurant_delivery_fee_kobo integer not null default 50000 check (restaurant_delivery_fee_kobo between 0 and 2000000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.wallet_settings(id) values (1) on conflict(id) do nothing;

create table if not exists public.wallet_settings_audit (
  id uuid primary key default gen_random_uuid(),
  changed_by uuid references public.profiles(id) on delete set null,
  previous_settings jsonb not null,
  new_settings jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 200),
  kind text not null check (kind in ('deposit','purchase','restaurant_earning','delivery_earning','commission','transfer','refund','withdrawal','adjustment')),
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  description text not null default '',
  provider_reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.wallet_transactions(id) on delete restrict,
  account_id uuid not null references public.wallet_accounts(id) on delete restrict,
  delta_kobo bigint not null check (delta_kobo <> 0),
  balance_after_kobo bigint not null check (balance_after_kobo >= 0),
  created_at timestamptz not null default now(),
  unique(transaction_id, account_id)
);
create index if not exists wallet_entries_account_history_idx on public.wallet_entries(account_id,created_at desc);

create table if not exists public.wallet_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wallet_accounts(id) on delete restrict,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  amount_kobo bigint not null check (amount_kobo > 0),
  state text not null default 'requested' check (state in ('requested','reviewing','processing','paid','failed','cancelled')),
  beneficiary_token text,
  account_last4 text check (account_last4 is null or account_last4 ~ '^[0-9]{4}$'),
  provider_reference text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wallet_withdrawals_owner_idx on public.wallet_withdrawal_requests(owner_user_id,created_at desc);

-- Snapshot restaurant-funded delivery and configurable fees on each new order.
-- No backfilling of historical money movements.
alter table public.orders add column if not exists restaurant_delivery_cost_kobo bigint not null default 0;
alter table public.orders add column if not exists restaurant_commission_bps integer;
alter table public.orders add column if not exists rider_commission_bps integer;
alter table public.orders add column if not exists rider_commission_kobo bigint not null default 0;
alter table public.orders add column if not exists restaurant_net_amount numeric(10,2);

-- Backfill account shells with zero funds, including existing users and venues.
insert into public.wallet_accounts(owner_user_id,kind)
select id,'customer' from public.profiles where role in ('customer','admin')
on conflict do nothing;
insert into public.wallet_accounts(owner_user_id,kind)
select id,'rider' from public.profiles where role = 'delivery_agent'
on conflict do nothing;
insert into public.wallet_accounts(owner_user_id,restaurant_id,kind)
select owner_id,id,'restaurant' from public.restaurants
on conflict do nothing;
insert into public.wallet_verifications(user_id)
select id from public.profiles on conflict(user_id) do nothing;

-- Create account shells for new profiles and restaurants without money mutation.
create or replace function public.wallet_prepare_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.wallet_verifications(user_id) values(new.id)
    on conflict(user_id) do nothing;
  if new.role in ('customer','admin') then
    insert into public.wallet_accounts(owner_user_id,kind) values(new.id,'customer')
      on conflict do nothing;
  elsif new.role = 'delivery_agent' then
    insert into public.wallet_accounts(owner_user_id,kind) values(new.id,'rider')
      on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.wallet_prepare_profile() from public, anon, authenticated;
drop trigger if exists wallet_prepare_profile_insert on public.profiles;
create trigger wallet_prepare_profile_insert after insert on public.profiles
for each row execute function public.wallet_prepare_profile();

create or replace function public.wallet_prepare_restaurant()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.wallet_accounts(owner_user_id,restaurant_id,kind)
  values(new.owner_id,new.id,'restaurant') on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.wallet_prepare_restaurant() from public, anon, authenticated;
drop trigger if exists wallet_prepare_restaurant_insert on public.restaurants;
create trigger wallet_prepare_restaurant_insert after insert on public.restaurants
for each row execute function public.wallet_prepare_restaurant();

-- Immutable entries; a correction must be a NEW balanced transaction.
create or replace function public.wallet_prevent_entry_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'Wallet ledger entries are immutable';
end;
$$;
revoke all on function public.wallet_prevent_entry_mutation() from public, anon, authenticated;
drop trigger if exists wallet_entries_immutable on public.wallet_entries;
create trigger wallet_entries_immutable before update or delete on public.wallet_entries
for each row execute function public.wallet_prevent_entry_mutation();

-- All tables are RLS protected. Money and verification statuses are writable
-- only through backend service-role operations (not through client JWTs).
alter table public.wallet_accounts enable row level security;
alter table public.wallet_verifications enable row level security;
alter table public.wallet_settings enable row level security;
alter table public.wallet_settings_audit enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.wallet_entries enable row level security;
alter table public.wallet_withdrawal_requests enable row level security;

create policy wallet_accounts_read_own on public.wallet_accounts
for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy wallet_verifications_read_own on public.wallet_verifications
for select to authenticated using ((select auth.uid()) = user_id);
create policy wallet_entries_read_own on public.wallet_entries
for select to authenticated using (
  exists (select 1 from public.wallet_accounts a where a.id = account_id and a.owner_user_id = (select auth.uid()))
);
create policy wallet_withdrawals_read_own on public.wallet_withdrawal_requests
for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy wallet_settings_read on public.wallet_settings
for select to authenticated using (true);

-- No INSERT, UPDATE or DELETE RLS policies for user-accessible wallets,
-- transaction entries or verification. Financial operations stay off
-- until regulated custody, idempotent posting and reconciliation are built.
