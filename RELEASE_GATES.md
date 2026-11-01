# Delixious — UX, reliability and scalability release gates

Status: **engineering changes proposed in PR #1; not deployed**.
The production Render service still tracks the legacy `delixious-backend` repository.

## Scope of this pass

- `DESIGN.md` and `UX-CONTRACT.md`: stable brand tokens, screen patterns, interaction and financial invariants.
- Shared icon and UI primitives, accessible search and confirmation flows.
- Route loading, field errors, modal keyboard containment, empty/error states.
- Read-only rider delivery discovery now uses SQL filtering and bounded pagination; payout is included in the response.
- API logs identify templated routes and request IDs instead of query strings or personal payment references.
- Proposed indexes for the common order, restaurant, menu, rider and notification queries.
- Bounded read-only **staging-only** load smoke utility with p50/p95/p99.
- Unit tests added for shared UI, modal focus, rider discovery and private API errors.

## Test commands (run in a working Node 20+ environment)

```bash
npm ci --include=dev
npm test
npm ci --include=dev --prefix frontend
npm run test:frontend
npm run build
```

Use the front-end browser test suite under `frontend/tests/`; source
`frontend/vite.config.js` now selects jsdom and test setup explicitly.

### Staging smoke: read-only endpoints only

```bash
BASE_URL=https://delixious-staging.onrender.com CONCURRENCY=10 REQUESTS=150 node scripts/load-smoke.mjs
```

The script refuses the known production hosts. Increase concurrency only
with approved staging capacity. A smoke test is NOT proof of 100,000 concurrent users.

## Must-pass E2E matrix before public launch

| Area | Essential cases |
| --- | --- |
| Customer | signup/login/refresh/logout, search/filter, images, cart conflict, full checkout price, failed and successful payment, order tracking and refunds |
| Restaurant | signup/approval, bank verification, menu upload, item availability, paid order notification, preparing, rider assignment, settlement reports |
| Rider | unapproved access denied, claim race (two riders), pickup/en-route/delivered transitions, payout confirmation and failure/reversal |
| Admin | role authorization on all routes, approval audits, commission change snapshots, no cross-owner reads |
| Wallet | own-account reads, verification status, deposits/withdrawals blocked until provider activation; immutable ledger invariant |
| Cross-device | Android 320/360/390px, tablet, desktop, keyboard-only, 200% zoom, reduced motion, network interruption |
| Incident | Paystack webhook redelivery, invalid signature/amount, refund dispute, payout timeout, database transient failure |
| Security | session CSRF, expired auth, RLS negative tests, no public service key, no PII in logs |

## Reliability and capacity targets

These are **goals**, not measured achievements:
- Read-only public endpoints: p95 under 1.5 seconds after warmup and under expected load.
- Write/order operations: no duplicate orders, charges or transfers after retry.
- Financial reconciliation: every provider charge/transfer has a unique verified local record or an operator-review incident.
- API errors: monitor 5xx, timeouts, p95/p99 and DB connection pool occupancy.
- Real performance: measure 10, 50, 100 concurrent users in staging, then scale through controlled increments with representative DB volume.
- For >1,000 or >100,000 concurrent users, redesign around load-balanced stateless workers, managed queues, cached public catalog reads, cost-aware DB indexes, pool sizing, object storage/CDN, fault isolation and peak traffic backpressure. Do not claim these targets on a single free Render instance.

## Operational blockers

1. **GitHub Actions jobs fail with zero steps** on the connected account; the failure is upstream of recorded test execution. Resolve runner/account status before claiming CI passed.
2. Live site has not been tested in a browser in this pass. Do not claim responsive screenshots or keyboard verification until tested.
3. No Sentry read-only token is currently configured; Sentry issue/event analysis cannot be performed. Configure access without exposing tokens in chat, then add scrubbed production monitoring.
4. Render metrics returned no samples for the queried period; no valid p95 or CPU/memory conclusions.
5. Apply migrations only on staging after schema review and EXPLAIN benchmarks; **do not run migrations on the live database from this PR**.
6. Delixious Wallet needs a regulated funding/custody partner and atomic double-entry posting before real money.
7. Current backend deploys from the old split repository, not this monorepo. Stage and validate the new deployment separately.

## Verification evidence available today

- 15 targeted backend/source files passed isolated JavaScript parsing checks.
- Five direct logic checks passed (pricing allocations, invalid merchant delivery cost, templated-route redaction, rider queue SQL paging/payout, unapproved rider restriction).
- Frontend interaction tests and more backend Vitest specs are committed but **not confirmed executed**, due to GitHub Actions runner failure.
- A code-only UX review is not a rendered/mobile UX acceptance test.

**Release decision:** do not merge/deploy to production or accept new public payments until all P0 gates are green.
