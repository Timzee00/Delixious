# Delixious — UX, reliability and scalability release gates

Status: **PR #1 merged to `main`; current dashboard and pagination improvements are committed to `main`; not deployed or production-verified**.
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



## Marketplace workspace and large-record handling (November 14, 2026)

- Customer, restaurant, rider and admin navigation now changes by authenticated role; operational roles no longer receive customer cart/location navigation as their primary workspace.
- Rider active deliveries and completed delivery history now use validated, bounded SQL pagination (20 per page by default, maximum 50) with exact result counts.
- Food discovery now exposes paged dishes through an explicit load-more interaction instead of silently stopping after the first 12 records.
- Paginated food, admin and rider query paths use deterministic secondary ordering to reduce duplicate/omitted records when timestamps tie.
- Rider earnings totals are explicitly labeled as the currently loaded page, not lifetime totals.
- Admin restaurant applications, rider records, user accounts and order review now use bounded pages with explicit result ranges and next/previous controls.
- Added controller tests for rider active/history SQL ranges and response metadata.

**Still not verified:** full backend/frontend Vitest suites, Vite production build, rendered role-specific screens, browser/device E2E, query-plan performance on production-sized data, and staging load tests. The latest Netlify production-context build for commit `2b1a4997f11b3aea611c4de0eddd0215cea44f57` reached **ready** and uploaded 33 changed files; this confirms the Vite build and Netlify packaging for that commit, not full tests or a production-alias switch. Subsequent backend ordering commits still require a fresh backend test run. These commits do not establish a measured capacity ceiling or production readiness.

## Browser compatibility and same-origin auth gate (November 1, 2026)

The previous Chrome-only experience may have been caused by the old frontend
calling Render directly, leaving browsers to handle third-party cookies.
**The fix is architectural: every browser must use its OWN origin for API traffic.**

Code now enforces:
- Axios always uses `/api` and ignores stale `VITE_API_URL` build variables.
- Vite proxies `/api` in development and `frontend/netlify.toml` uses a
  forced 200 rewrite to Render before the SPA fallback.
- Access and refresh cookies are host-only, Secure over HTTPS, HttpOnly,
  SameSite=Lax; refresh cookie path is `/api/auth`.
- A readable first-party CSRF cookie is repaired on `GET /api/auth/me`;
  the request interceptor uses the latest cookie and retries a server-rejected
  CSRF request only once after safe repair.
- Refresh-token races between tabs must not clear potentially newer cookies.
  Database/provider outages return a retryable error, not a false logout.
- The browser Realtime client cannot maintain a competing persisted Supabase
  authentication session.
- All API responses say `Cache-Control: private, no-store`.
- Sign-out errors are shown. Cart errors do not masquerade as an empty basket;
  payment must not start on an unverified cart.

### Required staged real-browser tests (not yet run)

| Browser | Required checks |
| --- | --- |
| Chrome Android + desktop | Login, reload, CSRF post, idle refresh, checkout, logout |
| Firefox desktop/Android | Same tests; Enhanced Tracking Protection enabled |
| Safari iOS/macOS | Same tests with Prevent Cross-Site Tracking enabled |
| Samsung Internet Android | Same tests on standard and privacy settings |
| Edge desktop/mobile | Same tests with tracking protection |
| Brave | Same tests with default shields |

For each browser, verify with the actual Netlify-deployed staging frontend:
1. In Developer Tools, `POST /api/auth/login` is sent to the **site's**
   domain, never directly to `onrender.com`. The response sets access,
   refresh and CSRF cookies for the site host with correct paths.
2. Reload `/orders`; session remains active. Repeat after token expiry and
   opening two tabs; no spurious sign-out.
3. Clear only the readable CSRF cookie, then submit a safe profile update.
   The interceptor should restore the cookie and retry exactly once.
4. Log out, reload, and confirm protected pages require login.
5. Block network, reload a protected page, and confirm the user sees Retry
   rather than an immediate login redirect. Restore network and recover.
6. Fail the cart GET and confirm the app shows Retry rather than an empty cart
   or starting checkout. Restore network, then complete the test-mode payment
   return to the same site origin.
7. Check cookies with third-party cookies disabled. Confirm API paths never
   serve index.html by mistake; unauthorized `/api/auth/me` should be JSON.
8. Test Netlify 200 proxy with `Set-Cookie` and ordinary authenticated
   requests. Check response `Cache-Control` and `X-Request-Id`.
9. Confirm known browser privacy limitations: private/incognito sessions or
   in-app browsers may erase storage when closed; do not promise permanent
   sign-in.

### Release decision

Do not claim Safari, Firefox, mobile, or Chrome compatibility until those
real-browser tests pass. The code-only changes and focused JavaScript checks
are not a substitute. Full npm suites and browser E2E are still blocked by
the current GitHub Actions runner issue.
