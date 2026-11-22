-- Explicitly separate Paystack test transactions from live financial liabilities.
alter table public.payments
  add column if not exists payment_environment text not null default 'live'
    check (payment_environment in ('test','live'));

alter table public.orders
  add column if not exists payment_environment text not null default 'live'
    check (payment_environment in ('test','live'));

-- Historical Paystack test-mode charges are not real customer funds and must
-- never be imported into live wallet balances or paid out to riders.
update public.payments
set payment_environment = 'test'
where raw_response->>'domain' = 'test';

update public.orders o
set payment_environment = 'test'
where exists (
  select 1 from public.payments p
  where p.checkout_group_id = o.checkout_group_id
    and p.payment_environment = 'test'
);

create index if not exists payments_environment_created_idx
  on public.payments(payment_environment,created_at desc);
create index if not exists orders_environment_created_idx
  on public.orders(payment_environment,created_at desc);
