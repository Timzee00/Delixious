# Delixious Wallet foundation — not live funds

The customer-facing feature is named **Wallet**. It is built into the current
Delixious app, not branded as a separate payment product.

## Implemented in this branch

- Authenticated `/wallet` page and `/api/wallet` routes.
- Separate account shells for customers, riders, and each restaurant.
- Account-scoped read-only activity API, identity verification status, and
  wallet withdrawal history.
- Database migration `supabase/Migration/009_wallet_foundation.sql` creates
  accounts, identity states, financial transaction/ledger tables, withdrawal
  requests, admin commission rates, and database audit history.
- RLS: customers can read their own wallet information; no client-side
  INSERT/UPDATE/DELETE on balances, ledger or KYC.
- Withdrawals require verified financial identity, but **all funding,
  withdrawal, virtual-bank and wallet-checkout actions remain disabled**
  until a licensed provider and reconciliation service are integrated.
- Admin can set restaurant and rider commission basis points (0–30%) and
  restaurant-funded delivery cost; changes are audited and affect future
  checkouts, not historical orders.
- Existing Paystack card/bank checkout now charges **food subtotal only**;
  delivery cost is deducted from the restaurant's split proceeds instead of
  being added to the customer checkout.

## How to apply

1. Test on a disposable Supabase project first, after existing migrations
   including `008_production_consistency.sql`.
2. Validate migration in staging: account backfill, all 7 RLS tables, triggers,
   audit history and owner-only selects (including negative authorization tests).
3. Run `npm test`, `npm run test:frontend` and `npm run build` under a
   working CI runner. Test Paystack splits in test mode with multiple
   restaurants, low order values, fees and refunds.
4. Keep current live settlement and payouts unchanged until the licensed
   partner confirms custody, funding, payout and transaction fee requirements.
5. Implement webhook-backed deposit reconciliation, immutable double-entry
   posting, clearing/liability accounting, bank-beneficiary verification,
   withdrawal holds and idempotent payouts before enabling any capability flag.
6. Do not backfill wallet credits from historical orders or received Paystack
   split transfers without reconciliation against actual provider settlements.
7. Enable wallet payment only once an atomic, balance-checked order payment
   process and refund process exist. This release does not debit wallets.

## Status

This is a **non-custodial development foundation**. The UI displays genuine
ledger account values (initially zero) and accurately labels unavailable
real-money operations. No real virtual bank account numbers are issued here.
