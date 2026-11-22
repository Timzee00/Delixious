# Delixious Financial Operations

## Launch policy

- Customer orders are paid directly through Paystack.
- Delixious does not offer customer stored-value funding, peer-to-peer wallet transfers, or wallet checkout.
- Restaurant commission is calculated on food and selected extras only.
- Customer-funded delivery is allocated to the rider at 100% of the configured delivery fee.
- Restaurant and rider earnings are accounting liabilities, not bank deposits.
- Automatic rider bank transfers are paused unless `ENABLE_AUTOMATIC_RIDER_PAYOUTS=true` is explicitly set after certification.
- Manual wallet withdrawals remain disabled in the application.

## Accounting model

All amounts are stored in integer kobo. Every posted journal is an immutable, balanced double-entry journal. The database posting RPC enforces:

1. At least two and no more than 100 journal lines.
2. Positive integer-kobo amounts.
3. Active account codes only.
4. Total debits equal total credits.
5. Unique idempotency keys with payload equality on retries.
6. No direct insert/update/delete of posted journals or journal lines outside the posting function.

Wallet balances are derived from journal lines. The legacy mutable balance columns are not an accounting source of truth.

### Control accounts

- `SYS:PAYSTACK_CLEARING`: funds recorded against Paystack before settlement reconciliation.
- `SYS:RESTAURANT_PAYABLE`: parent control for restaurant wallet subledgers.
- `SYS:RIDER_PAYABLE`: unassigned rider-delivery liabilities.
- `SYS:PLATFORM_COMMISSION_REVENUE`: earned marketplace commission.
- `SYS:PAYSTACK_PROCESSING_EXPENSE`: payment processing costs.
- `SYS:CUSTOMER_REFUNDS_PAYABLE`: approved customer refunds awaiting provider completion.
- `SYS:CHARGEBACKS_PAYABLE`: chargeback exposure.
- `SYS:BANK_SETTLEMENT`: confirmed funds received in the platform bank account.

## Payment posting

A successful Paystack charge is not considered fully finalized until its checkout group's order allocations have been checked against the verified payment amount and the corresponding journal is posted.

The payment journal:
- Debits Paystack clearing for the verified customer charge.
- Credits each restaurant's pending wallet subledger.
- Credits the unassigned rider payable control.
- Credits platform commission revenue.

The journal idempotency key is derived from the Paystack payment reference. A retried webhook cannot post the same payment twice.

## Rider earnings and transfers

After delivery, the rider's allocated delivery amount is moved from the unassigned rider control account into the rider's available wallet subledger.

A payout record is created before any provider transfer request. A successful transfer debits the rider's available wallet and credits Paystack clearing. A reversal posts the exact opposite journal. A failed transfer does not erase the rider's earned balance.

Payouts without a verified recipient, or while automatic payouts are not certified, remain on hold. They must not be silently discarded or marked paid.

## Provider events

Paystack webhooks are recorded in `financial_provider_events`. The inbox:
- Deduplicates repeated events.
- Stores a sanitized financial payload.
- Tracks processing attempts and errors.
- Returns a retryable response when another worker is still processing an event.
- Allows stale processing leases to be reclaimed after five minutes.

## Scale and history

Financial journals, payout records, and provider events use descending timestamp/UUID cursor pagination. The database has indexes for account history, journal history, payout queues, event queues and control-account rollups. Admin endpoints return bounded pages rather than loading the full ledger.

## Free-tier operations

- A Supabase `pg_cron` job runs the internal financial health watchdog every 15 minutes. It checks balanced journals, successful live payments without ledger entries, aged pending payments, expired processing leases, failed/stale provider events, failed/stale payouts, and paid orders without matching live payments.
- The watchdog runs in the database and does not depend on the Render Free web service staying awake. It retains 90 days of check history.
- Admins can manually reconcile up to 10 oldest eligible live pending/processing payments at a time by asking Paystack to verify each reference. This is a recovery action, not a substitute for a provider settlement statement.
- Paystack test-mode transactions are explicitly tagged `test`; they can exercise ordering but never post live ledger entries or create rider transfers. Historical test payments are classified by provider domain and reference.
- Refund and dispute webhooks are captured in the provider-event inbox and flagged for manual financial review. They are not silently ignored and do not automatically alter wallet balances.

## Still required before live-money certification

1. Reconcile Paystack main-account and restaurant-subaccount settlements against actual settlement reports.
2. Implement and test full/partial refunds, chargebacks, cancellation after capture, and reversal recovery.
3. Verify the Paystack split shares and fee bearer for each checkout before marking the payment fully reconciled.
4. Add controlled payout retry tooling and a scheduled reconciliation worker.
5. Run Paystack test-mode scenarios for duplicate webhooks, out-of-order events, delayed settlement, failed transfer and transfer reversal.
6. Run a small live pilot with written Paystack approval and Nigerian payments-law advice.
7. Enable leaked-password protection and resolve remaining dependency vulnerabilities.
8. Complete a database backup restore test and document emergency response ownership.

Do not enable `ENABLE_AUTOMATIC_RIDER_PAYOUTS` until the above financial controls have passed review.
