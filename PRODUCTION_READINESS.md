# Delixious production-readiness baseline

**Status:** Source code consolidated into `Timzee00/Delixious` on `main`. Not certified production-ready. Do not point production deployments to a new build until the checks below pass. The older frontend/backend repositories remain available for rollback and reference.

## Verified baseline

- The React/Vite frontend, Express API, Supabase schema/migrations, backend and frontend tests, OpenAPI specification, and Render configuration live in one repository.
- The Git tree contains 154 tracked files: 80 frontend and 74 backend/configuration.
- Existing `.env.example` templates were sanitized before import. Never commit real environment variables or service-role/Paystack secrets.
- GitHub Actions for the import commit reported failures for both CI jobs with no published execution steps. This is an **unresolved CI/runner/account check**, not evidence that tests failed or passed. Investigate Actions job diagnostics and account billing/usage limits.

## Release gates (must pass before a real-money launch)

1. **Reproducible builds:** Node.js 20; `npm ci`, `npm test`, `npm ci --prefix frontend`, `npm run test:frontend`, and `npm run build` on a working runner. No deployment if any gate fails. Verify lockfiles.
2. **Safe staging:** Use separate Supabase staging credentials and Paystack **test** keys. Configure `FRONTEND_URL`, `VITE_API_URL=/api`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` at build time as appropriate. Never use `VITE_` for secret/service-role keys. Confirm Render serves both `/api/health` / `/health` and the frontend on the intended origin.
3. **Authentication:** Test signup, verification email, login, refresh, logout, password reset, suspension, and permissions on Chrome, Firefox, and mobile browsers. Ensure `Secure`, `HttpOnly`, and `SameSite=Lax` cookie settings are correct on HTTPS and via the local `/api` proxy.
4. **Real money and orders:** Verify Paystack webhook signatures **and payment amount/currency/reference** against stored records before fulfillment; test duplicate webhooks, failed payments, timeouts, refunds, cancelled orders, concurrent checkouts, partial writes, and idempotency. Ensure no cart loss on failed checkout.
5. **Database and roles:** Audit Supabase RLS and admin/service-role queries for customer, restaurant owner, rider, and admin separation. Apply migrations in staging, back up database, and test rollback.
6. **Uploads and abuse:** Check file size, MIME/content type, authenticated ownership, private-storage access, sanitization, rate limits, and API error responses. Disable public access to sensitive rider/customer documents.
7. **Reliability:** Add structured logs, uptime checks, error tracing, backup/restore drills, payment reconciliation, and queue/retry strategy before relying on live delivery flows.
8. **End-to-end user journeys:** Customer browsing/cart/checkout/tracking; restaurant onboarding/approval/menu/dispatch; rider assignment/confirmation/payout; administrator moderation and reporting. Cover weak network, small screens, repeated taps, and accessibility.

## Work already started

- `production-foundation-auth-cookies`: eliminate development `SameSite=None` without `Secure` (a cookie configuration rejected by modern browsers), add regression tests; review and merge only after checks are available.
- Treat the existing `render.yaml` as **configuration**, not proof of successful deployment. Keep live sites unchanged until verified staging succeeds.

## Recommended build sequence

**P0:** working CI + staging + auth/payments integrity. **P1:** reliable order/delivery lifecycle, idempotency, monitoring. **P2:** frontend usability and performance, scale and cost testing. Track each change in a small PR with a repeatable test and deployment rollback instructions.
