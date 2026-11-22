-- Restrict journal/header insertion to the validated atomic posting RPC.
create or replace function public.financial_journal_insert_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('delixious.financial_ledger_write', true), 'off') <> 'on' then
    raise exception 'Financial journal records can only be created through post_financial_journal';
  end if;
  return new;
end;
$$;
revoke all on function public.financial_journal_insert_guard() from public,anon,authenticated;

drop trigger if exists financial_journals_insert_guard on public.financial_journals;
create trigger financial_journals_insert_guard
before insert on public.financial_journals
for each row execute function public.financial_journal_insert_guard();

drop trigger if exists financial_journal_lines_insert_guard on public.financial_journal_lines;
create trigger financial_journal_lines_insert_guard
before insert on public.financial_journal_lines
for each row execute function public.financial_journal_insert_guard();

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

  if v_line_count < 2 or v_line_count > 100 then
    raise exception 'A financial journal requires between 2 and 100 lines';
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

  perform pg_catalog.set_config('delixious.financial_ledger_write','on',true);

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
    perform pg_catalog.set_config('delixious.financial_ledger_write','off',true);
    return v_journal_id;
  end if;

  insert into public.financial_journal_lines(journal_id,account_id,side,amount_kobo)
  select v_journal_id,a.id,x.side,x.amount_kobo
  from jsonb_to_recordset(p_lines) as x(account_code text, side text, amount_kobo bigint)
  join public.financial_accounts a on a.account_code = x.account_code and a.is_active = true;

  perform pg_catalog.set_config('delixious.financial_ledger_write','off',true);
  return v_journal_id;
end;
$$;
revoke all on function public.post_financial_journal(text,text,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.post_financial_journal(text,text,text,text,jsonb,jsonb) to service_role;
