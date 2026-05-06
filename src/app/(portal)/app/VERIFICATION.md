# Mailmind App — Foundation Verification

This document maps the brief's Step 4 verification scenarios to specific code paths and how to test each one. Run these before merging the foundation to `main`.

## What was built (Phase 1 foundation)

| Layer | File | Purpose |
|---|---|---|
| Schema fix | `src/lib/db/schema.ts` | UNIQUE on `(organization_id, month)` in `usage_counters` |
| Auth boundary | `src/proxy.ts` | Adds `/app(.*)` and `/api/app(.*)` to protected routes |
| Entitlement core | `src/lib/app/entitlements.ts` | `getCurrentAccount`, `computeAccess`, `assertCanGenerateAiDraft`, `getEntitlements`, `getCurrentUsage` |
| Usage tracking | `src/lib/app/usage.ts` | `incrementAiDraftUsage` (atomic + guarded), `incrementEmailsProcessed`, `getCurrentMonthCounter` |
| Audit log | `src/lib/app/audit.ts` | Typed `writeAuditLog` with `AuditAction` union |
| Status API | `src/app/api/app/me/route.ts` | Consolidated GET endpoint per brief §11 |
| Onboarding API | `src/app/api/app/onboarding/route.ts` | POST creates user + org, single-tenant |
| App layout | `src/app/app/layout.tsx` | Defence-in-depth auth check |
| App page | `src/app/app/page.tsx` | Plan, status, usage, access banners |
| Onboarding page | `src/app/app/onboarding/page.tsx` + `OnboardingForm.tsx` | Explicit setup flow |

## Database tables touched

| Table | Read | Write |
|---|---|---|
| `users` | yes (resolve clerkUserId) | yes (`syncUserAndOrganization`) |
| `organizations` | yes | yes (created on onboarding) |
| `subscriptions` | yes (latest per org) | no (Stripe webhook owns writes) |
| `license_entitlements` | yes | no (Stripe webhook owns writes) |
| `usage_counters` | yes (current month) | yes (atomic upsert via `incrementAiDraftUsage`) |
| `audit_logs` | no | yes (`writeAuditLog`) |

No new tables yet. Triage tables (`inboxes`, `email_threads`, `ai_drafts`, etc.) come in Phase 2.

## Verification scenarios (brief §14 Step 4)

### 1. Logged-out user is blocked
- Navigate to `/app` while signed out → redirected to `/login`
- Mechanism: Clerk middleware in `src/proxy.ts` `auth.protect()`
- Defence in depth: `app/layout.tsx` re-checks `userId` and redirects

### 2. Logged-in user without DB row → onboarding
- Sign up via `/signup`, then visit `/app`
- Expected: `/app/page.tsx` detects `account.user === null` and redirects to `/app/onboarding`
- Onboarding page calls `POST /api/app/onboarding` → `syncUserAndOrganization` creates org + user
- After success, redirected back to `/app`

### 3. Logged-in user without subscription → blocked from paid features
- After onboarding (step 2), no subscription has been purchased yet
- Expected on `/app`:
  - Page renders (canUseApp = true... wait, let me check — actually `no_subscription` is in `blocked()` which sets `canUseApp = false`)
  - Wait — re-checking `entitlements.ts`: `if (!subscription) return blocked("no_subscription")` and `blocked` sets canUseApp = false.
  - So user IS blocked from the app. The page shows "No active subscription" banner with link to `/dashboard/billing`.
- Expected GET `/api/app/me`: `access.canUseApp = false`, `access.reason = "no_subscription"`

### 4. Active subscriber → allowed
- After Stripe checkout completes and webhook fires (`/api/webhooks/stripe`)
- `subscriptions.status` = `"active"`, `licenseEntitlements` populated from `PLANS[plan]`
- Expected on `/app`: full UI, no warning banner, usage card shows `0 / 500` (Starter) or higher
- `access.canUseApp = true`, `access.canGenerateAiDraft = true`

### 5. Usage limit reached → AI generation blocked
- Manually set `usage_counters.aiDraftsUsed = 500` for a Starter org
- Expected: `access.canGenerateAiDraft = false`, `access.reason = "ai_draft_limit_reached"`
- Banner shows "Monthly AI draft limit reached"
- Calling `incrementAiDraftUsage(clerkUserId)` returns `{ ok: false, reason: "limit_reached" }` BEFORE incrementing
- Calling `assertCanGenerateAiDraft(clerkUserId)` returns `{ ok: false, reason: "ai_draft_limit_reached" }`

### 6. Usage increments after AI draft
- With active sub, current usage = 5
- Call `incrementAiDraftUsage(clerkUserId)`
- Returns `{ ok: true, aiDraftsUsed: 6, limit: 500 }`
- Audit log row written: `action = "ai_draft_generated"`, `metadata.newCount = 6`
- DB row in `usage_counters` for `(org_id, current_month)` has `ai_drafts_used = 6`

### 7. past_due policy
- Set `subscriptions.status = "past_due"`
- Expected: `access.canUseApp = true`, `access.canGenerateAiDraft = false`, `access.reason = "past_due"`
- Banner: "Payment past due — Update your card to keep generating AI drafts"
- Read-only access maintained — user can see existing data and click "Update payment" → `/dashboard/billing`

## Known constraints / Phase 2 work

1. **`canAddInbox` and `canInviteUser`** are computed against `inboxesUsed = 0` and `usersUsed = 1` (hardcoded). Real counts come when `inboxes` and `users` tables get queried — Phase 2.
2. **Race conditions on `incrementAiDraftUsage`**: TOCTOU between read-check and atomic upsert. Worst case: one extra draft over the limit. Acceptable for now (Stripe doesn't bill on these counters).
3. **Stripe status mapping incomplete**: Stripe's `unpaid` and `incomplete_expired` are not in our DB enum. Needs handling in webhook before they crash enum validation.
4. **Clerk publicMetadata staleness**: only updated on `checkout.completed`, not on `subscription.updated/deleted`. Pre-existing issue (not introduced by this work).
5. **No Clerk webhook handler**: user lifecycle (delete, email change) doesn't sync to DB yet. Pre-existing.

## Required env vars to run

Already in `.env.example`:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL` (mock fallback if missing)
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID_STARTER|TEAM|BUSINESS`
- `NEXT_PUBLIC_APP_URL`

No new env vars introduced.

## Migration after schema change

After pulling the new schema:
```bash
npm run db:push
```

The added UNIQUE constraint on `usage_counters(organization_id, month)` may fail if any duplicate rows already exist. Run this query first to check:

```sql
SELECT organization_id, month, COUNT(*)
FROM usage_counters
GROUP BY organization_id, month
HAVING COUNT(*) > 1;
```

If any rows return, dedupe by summing counters and keeping one row per (org, month) before pushing.
