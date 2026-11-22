-- Map wallet-specific subledger accounts to their general-ledger control accounts.
alter table public.financial_accounts
  add column if not exists control_account_id uuid references public.financial_accounts(id) on delete restrict;
create index if not exists financial_accounts_control_idx
  on public.financial_accounts(control_account_id) where control_account_id is not null;

insert into public.financial_accounts(account_code,account_name,account_type,normal_side)
values ('SYS:CUSTOMER_WALLET_LIABILITY','Customer wallet liability control','liability','credit')
on conflict(account_code) do nothing;

update public.financial_accounts leaf
set control_account_id = control.id
from public.wallet_accounts wa,
     public.financial_accounts control
where leaf.wallet_account_id = wa.id
  and control.account_code = case wa.kind
    when 'restaurant' then 'SYS:RESTAURANT_PAYABLE'
    when 'rider' then 'SYS:RIDER_PAYABLE'
    else 'SYS:CUSTOMER_WALLET_LIABILITY'
  end
  and leaf.control_account_id is null;

create or replace function public.wallet_create_financial_accounts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_control_account_id uuid;
begin
  select id into v_control_account_id
  from public.financial_accounts
  where account_code = case new.kind
    when 'restaurant' then 'SYS:RESTAURANT_PAYABLE'
    when 'rider' then 'SYS:RIDER_PAYABLE'
    else 'SYS:CUSTOMER_WALLET_LIABILITY'
  end
  and wallet_account_id is null
  and is_active = true;

  if v_control_account_id is null then
    raise exception 'Wallet control account is not configured for kind %', new.kind;
  end if;

  insert into public.financial_accounts(
    account_code,account_name,account_type,normal_side,wallet_account_id,wallet_bucket,control_account_id
  )
  values
    ('WALLET:' || new.id::text || ':available', initcap(new.kind) || ' wallet available', 'liability', 'credit', new.id, 'available', v_control_account_id),
    ('WALLET:' || new.id::text || ':pending', initcap(new.kind) || ' wallet pending', 'liability', 'credit', new.id, 'pending', v_control_account_id),
    ('WALLET:' || new.id::text || ':held', initcap(new.kind) || ' wallet held', 'liability', 'credit', new.id, 'held', v_control_account_id)
  on conflict(account_code) do nothing;
  return new;
end;
$$;
revoke all on function public.wallet_create_financial_accounts() from public,anon,authenticated;

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
      coalesce((
        select sum(case when l.side = leaf.normal_side then l.amount_kobo else -l.amount_kobo end)
        from public.financial_accounts leaf
        join public.financial_journal_lines l on l.account_id = leaf.id
        where leaf.id = a.id or leaf.control_account_id = a.id
      ),0)::bigint as balance_kobo
    from public.financial_accounts a
    where a.wallet_account_id is null
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
