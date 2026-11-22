-- Free-tier database-native financial watchdog. No external worker or paid cron service.
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.financial_health_checks (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('healthy','warning','critical')),
  critical_count integer not null default 0 check (critical_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  checks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists financial_health_checks_created_idx
  on public.financial_health_checks(created_at desc,id desc);
alter table public.financial_health_checks enable row level security;
revoke all on public.financial_health_checks from anon,authenticated;

create or replace function public.run_financial_health_check()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checks jsonb := '[]'::jsonb;
  v_critical integer := 0;
  v_warning integer := 0;
  v_count bigint;
  v_status text;
begin
  -- Posted journals must always balance.
  select count(*) into v_count
  from (
    select l.journal_id
    from public.financial_journal_lines l
    group by l.journal_id
    having sum(case when l.side='debit' then l.amount_kobo else 0 end)
        <> sum(case when l.side='credit' then l.amount_kobo else 0 end)
  ) q;
  if v_count > 0 then
    v_critical := v_critical + 1;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','UNBALANCED_JOURNALS','severity','critical','count',v_count,
      'message','One or more posted journals do not balance.'
    ));
  end if;

  -- A captured live payment without a finalized ledger journal is a critical exception.
  select count(*) into v_count
  from public.payments p
  where p.payment_environment='live'
    and p.status='success'
    and not exists (
      select 1 from public.financial_journals j
      where j.idempotency_key='paystack-charge:' || p.reference
    );
  if v_count > 0 then
    v_critical := v_critical + 1;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','LIVE_PAYMENT_WITHOUT_JOURNAL','severity','critical','count',v_count,
      'message','Successful live payments are missing their accounting journal.'
    ));
  end if;

  -- Old pending payments can indicate an abandoned checkout or lost provider callback.
  select count(*) into v_count
  from public.payments
  where payment_environment='live' and status='pending'
    and created_at < now() - interval '30 minutes';
  if v_count > 0 then
    v_warning := v_warning + 1;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','AGED_PENDING_PAYMENTS','severity','warning','count',v_count,
      'message','Live payments have remained pending for more than 30 minutes.'
    ));
  end if;

  -- Stale payment finalization leases need a retry or manual review.
  select count(*) into v_count
  from public.payments
  where payment_environment='live' and status='processing'
    and coalesce(processing_started_at,updated_at) < now() - interval '5 minutes';
  if v_count > 0 then
    v_warning := v_warning + 1;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','STALE_PAYMENT_PROCESSING','severity','warning','count',v_count,
      'message','Payment finalization leases have expired.'
    ));
  end if;

  select count(*) into v_count
  from public.financial_provider_events
  where state='failed'
     or (state='processing' and processing_started_at < now() - interval '5 minutes');
  if v_count > 0 then
    v_warning := v_warning + 1;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','PROVIDER_EVENTS_NEED_ATTENTION','severity','warning','count',v_count,
      'message','Failed or stale Paystack events need retry or review.'
    ));
  end if;

  select count(*) into v_count
  from public.financial_payouts
  where status='failed'
     or (status='processing' and updated_at < now() - interval '10 minutes');
  if v_count > 0 then
    v_warning := v_warning + 1;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','PAYOUTS_NEED_ATTENTION','severity','warning','count',v_count,
      'message','Failed or stale payouts need manual reconciliation.'
    ));
  end if;

  select count(*) into v_count
  from public.orders o
  where o.payment_environment='live' and o.payment_status='paid'
    and not exists (
      select 1 from public.payments p
      where p.checkout_group_id=o.checkout_group_id
        and p.payment_environment='live' and p.status='success'
    );
  if v_count > 0 then
    v_critical := v_critical + 1;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','PAID_ORDER_WITHOUT_LIVE_PAYMENT','severity','critical','count',v_count,
      'message','Live paid orders do not have a matching successful payment.'
    ));
  end if;

  v_status := case when v_critical > 0 then 'critical'
                   when v_warning > 0 then 'warning' else 'healthy' end;

  insert into public.financial_health_checks(status,critical_count,warning_count,checks)
  values (v_status,v_critical,v_warning,v_checks);

  delete from public.financial_health_checks
  where created_at < now() - interval '90 days';

  return jsonb_build_object(
    'status',v_status,'critical_count',v_critical,'warning_count',v_warning,
    'checks',v_checks,'checked_at',now()
  );
end;
$$;
revoke all on function public.run_financial_health_check() from public,anon,authenticated;
grant execute on function public.run_financial_health_check() to service_role;

create or replace function public.get_latest_financial_health()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object(
      'status',h.status,'critical_count',h.critical_count,
      'warning_count',h.warning_count,'checks',h.checks,'checked_at',h.created_at
    )
     from public.financial_health_checks h
     order by h.created_at desc,h.id desc limit 1),
    jsonb_build_object('status','not_run','critical_count',0,'warning_count',0,'checks','[]'::jsonb,'checked_at',null)
  );
$$;
revoke all on function public.get_latest_financial_health() from public,anon,authenticated;
grant execute on function public.get_latest_financial_health() to service_role;

-- Execute immediately, then every 15 minutes. pg_cron runs inside Supabase Postgres.
select public.run_financial_health_check();
select cron.unschedule(jobid) from cron.job where jobname='delixious-financial-health';
select cron.schedule('delixious-financial-health','*/15 * * * *',
  $$select public.run_financial_health_check();$$);
