alter table public.orders
  add column if not exists restaurant_paystack_subaccount_code text;
