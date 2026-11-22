-- Historical test payments predate checkout_group_id. Link them by immutable
-- Paystack payment_reference as well as checkout_group_id.
update public.orders o
set payment_environment='test'
where exists (
  select 1 from public.payments p
  where p.payment_environment='test'
    and (
      (o.payment_reference is not null and p.reference=o.payment_reference)
      or (o.checkout_group_id is not null and p.checkout_group_id=o.checkout_group_id)
    )
);

-- Re-run the watchdog after correcting historical environment classification.
select public.run_financial_health_check();
