# Delixious — UX, reliability and scalability release gates

Status: **PR #1 merged to `main`; current SVG, workspace and large-record improvements are committed to `main`. Frontend build verified on Netlify preview; backend tests and production rollout remain unverified.**
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


### Latest visual QA follow-up (November 14, 2026)

A read-only browser check of the preceding customer homepage build at 1440×900 and 390×844 found no console errors, failed requests or HTTP 4xx/5xx responses. It identified mobile content overlap near the fixed bottom navigation, a sticky-header overlap near the partner CTA, a horizontally clipped filter row, and excess whitespace when a section has only one card. The follow-up commits compact the mobile header into one row, increase bottom safe-area spacing, and wrap filter chips rather than clipping them.

**Retest status:** NOT RUN after those follow-up changes because the connected browser inspection service returned an insufficient-credits error. Do not mark the visual defects closed until the updated deploy is inspected again. The Netlify build artifact is ready, but its deployment metadata has no `published_at`; the production alias switch is not confirmed. The Render backend still uses the legacy split repository, so the new backend pagination contracts are not live until that service is deliberately migrated and tested.

## Visual system, workspace completion and data scale (November 14, 2026)

### Delivered in this pass
- Added an original inline SVG scene library for discovery, cart, orders, notifications, favorites, kitchen, delivery, payment, success and unavailable states. It follows the Delixious pepper/ink/sand/jade palette and uses accessible SVG labels.
- Extended the shared SVG icon family for food categories, navigation, restaurant operations, admin, riders, finance, filters and state indicators. Food category circles now use distinct cooking-pot, sandwich, soup and flame symbols when menu photography is unavailable.
- Added SVG-first cues to cart/favorites/order empty states, rider empty states, restaurant menu and order workspaces, admin overview and order tracking stages. Essential actions retain concise visible labels; icons do not replace ambiguous action text.
- Reworked restaurant, rider and admin workspaces with role-specific navigation and task-focused headings.
- Added bounded page reads and database-side filters to restaurant menu management, public restaurant menus, restaurant owner lists, restaurant order queues, customer order history, rider active/history lists, admin partners/users/orders, notifications and saved restaurants.
- Customer favourites support server-side name search and page-scoped favourite indicators. Home and restaurant cards request favourite status only for visible restaurant IDs; this avoids treating a small first-page subset as the complete saved list.
- Admin broadcasts use bounded recipient pages and small insert batches. The endpoint explicitly reports partial completion; the UI shows an audience preview and confirmation step.
- Added safe payout response projections: browser session data omits rider bank account numbers and Paystack recipient identifiers, and payout screens display connection status plus the last four digits only. Duplicate payout-recipient/subaccount creation is blocked.
- Added focused regression tests for rider pagination, favourite pagination and broadcast batching/partial failure.
- Added read-index candidates for restaurant menu filtering and favourites to migration 010. These indexes have not been applied.

### Verification snapshot
- Netlify build 6af89f6de81ffc8b43608397 is ready for commit 8468e967e29cf0d08b53b5bebb6509ee12f389e9, using Vite. It uploaded the generated page and changed assets, and processed both redirect rules without errors.
- Netlify metadata reports no published_at; this ready deploy is not proof that the production alias was switched. The preview URL is https://6af89f6de81ffc8b43608397--delixious.netlify.app/.
- GitHub Actions returned no workflow runs for the latest engineering commit. The new backend/frontend Vitest tests and a production build have NOT RUN in a working test runner during this pass.
- The last available browser inspection was for an earlier build. It found no console/network errors at 1440x900 and 390x844, but recorded mobile overlay/filter visibility issues. Follow-up commits address those layout issues; the browser service then ran out of credits, so the updated layout was NOT re-inspected.
- No Supabase migration was applied, no real customer/order/financial rows were changed, and no live payment or payout was initiated.

### Remaining pre-launch gates
1. Run `npm ci --include=dev && npm test` at repository root.
2. Run `npm ci --include=dev --prefix frontend && npm run test:frontend --prefix frontend && npm run build --prefix frontend`.
3. Reconcile restaurant payout percentage configuration with marketplace allocation settings. The current Paystack subaccount creation flow has a hard-coded 10% setting; do not enable live settlements until this agrees with checkout/ledger rules.
4. Review schema/index overlap; apply migration 010 only to staging first and compare query plans with representative thousand-record tables.
5. Test owner isolation, admin role authorization, profile secret filtering, duplicate payout protection, paid-only restaurant order queues and partial broadcast behavior against a staging database.
6. Run customer, restaurant, rider and admin end-to-end tests in current Chrome, Firefox, Safari and Samsung Internet on mobile and desktop.
7. Migrate the existing Render service from its legacy split backend repository to the monorepo only after staging proves same-origin auth, API routing, webhook, delivery and payment flows. Preserve existing service environment variables and production data.
8. Confirm Netlify production alias publication separately from a ready preview deploy.
9. Measure p95/p99, DB plans, connection pool and representative concurrent load. Offset pagination is adequate for the present thousands-of-records target with candidate indexes; larger growth should move high-volume timelines to keyset/cursor pagination and read-model aggregates.

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
