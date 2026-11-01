# Delixious UX and Engineering Contract

**Scope:** Nigerian consumer food ordering, restaurant operations, rider delivery, admin controls and Wallet. Product language: English (Nigeria), currency: NGN. Responsive: mobile-first 320px and up. All icons: standard SVG; no emoji UI.

## Canonical ownership
| Capability | Owner | Behavior |
|---|---|---|
| App routes and role gates | `frontend/src/App.jsx`, `ProtectedRoute.jsx` | Protected actions redirect to login, role errors have recovery link |
| Global colors & typography | `frontend/tailwind.config.js`, `frontend/src/index.css` | DESIGN.md mirrors runtime tokens |
| SVG icons | `frontend/src/components/ui/Icon.jsx` | One 24px viewBox family, with labeled icon-only controls |
| Button/field/surface | `frontend/src/components/ui/Primitives.jsx` | Primary, secondary, danger and disabled/busy states |
| Confirmations | `frontend/src/components/ConfirmModal.jsx`, `Modal.jsx` | Focus-safe app-owned dialog, destructive action names consequence |
| Loading and empty/error | `frontend/src/components/StateViews.jsx` | Accessible status and explicit recovery action |
| Forms | Existing `FormField.jsx`, shared primitive for new flows | Labeled input, error association, preserve values |
| Tables | Native tables for financial/admin data | Server-side pagination; no unbounded queries |
| Lists/feed | `Restaurants.jsx`, menu feed | Explicit load-more, predictable loading/empty/error states |
| Toast/status | Inline status (`role=status/alert`) for touched flows | Never hide critical errors only in a transient toast |

## Primary workflows
- **Customer:** discover > filter/search > view menu > add to cart > address > see full food amount > Paystack > verified payment > order status > delivery > review.
- **Restaurant:** register > admin approval + payout setup > menu > receive paid orders > preparing > assign/allow eligible rider > delivery status and settlement history.
- **Rider:** register > admin approval > claim/accept paid eligible delivery > pickup > en route > delivered > payout pending/confirmed by provider.
- **Wallet:** account shell > view balances/history > financial verification > funding/withdrawals only after compliant provider activation. It is NOT a bank account.
- **Admin:** approve partners > configure commission/restaurant-funded delivery > read reconciled order/payout records > audit changes.

## Critical invariants
- The customer is not charged a hidden fixed delivery amount. Restaurant-funded delivery is deducted from restaurant proceeds.
- No paid cancellation without a verifiable refund workflow; no misleading 'refund completed' state.
- Never credit a wallet from a client request or simulate balance updates. Provider webhook and atomic double-entry ledger are prerequisites.
- Do not mark rider payout paid on transfer initiation. Require signed provider success evidence.
- In-flight and fulfilled checkout attempts are idempotent; payment amount, reference and currency must match local records.
- Every API mutation uses authorization, validation and atomic persistence when state and money are related.
- Customer can read only their own order, wallet and notification data; restaurant role is scoped to owned restaurants; rider role to assigned deliveries; admin actions audit sensitive changes.

## Interaction patterns
- Controls have visible hover, focus-visible, pressed and disabled states with accessible labels.
- Search debounce 300ms; stale results must not replace the latest query. Clear button keyboard accessible.
- Error -> actionable message; retry only for safe reads. Do not silently repeat payment/submission side effects.
- Busy state prevents duplicate submissions and keeps button dimensions stable.
- Empty view explains next action. Offline/network errors must not appear as empty results.
- Do not reuse a token, locale or status label with a different meaning on another screen.
- Native form selection is allowed; maintain labels and keyboard semantics.
- No layout jumps for async data, especially cart totals and financial balances.

## Engineering gates
Run backend `npm test`; frontend `npm run test:frontend`; build `npm run build`; validate root migrations against staging; verify live provider webhook in **test** mode; browser E2E across roles and widths; inspect failed runner logs. Separately load test authenticated API with realistic concurrency before announcing a capacity claim.

**No claim of 100k concurrent users** is justified without p95/p99 latency, DB pool occupancy, cache hit ratios, error budget, payment reconciliation results and real load-test evidence.
