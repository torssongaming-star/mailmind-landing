# Mailmind — Project State

> **Shared context for all agents and contributors.**
> Read this FIRST at the start of any session. Update it after meaningful changes.
> If this file disagrees with the code, the code wins — but flag the drift.

---

## What Mailmind is

Swedish B2B SaaS that uses AI to triage customer-support email. Customer forwards their support inbox to a unique `<slug>@mail.mailmind.se` address; we receive it, the AI classifies it (`ask` / `summarize` / `escalate`) and writes a draft reply; the agent reviews and sends with one click.

Target: Swedish SMBs (5-50 employees) drowning in support email who don't want a full Zendesk setup.

---

## Stack (as shipped)

| Concern | Tool |
|---|---|
| Framework | Next.js 16 App Router |
| Auth | Clerk (middleware in `proxy.ts`) |
| DB | Neon Postgres + Drizzle ORM 0.45 (HTTP serverless driver) |
| Billing | Stripe (checkout + portal + webhooks) |
| Inbound email | SendGrid Inbound Parse → `/api/webhooks/sendgrid/inbound` |
| Outbound email | Resend |
| AI | Anthropic SDK, `claude-haiku-4-5-20251001`, prompt caching (cache_control: ephemeral) |
| Hosting | Vercel |

Domain: `mailmind.se`. Inbound mail subdomain: `mail.mailmind.se`.

---

## Architectural ground truth

- **Multi-tenant.** Every read/write scoped by `organizationId`. Resolved server-side via `getCurrentAccount()` in `src/lib/app/entitlements.ts`. Never trust client-supplied org id.
- **Entitlement gating** in `src/lib/app/entitlements.ts` — `assertCanGenerateAiDraft`, `computeAccess`. Plan limits read from DB, never from client props.
- **Org sync priority** in `src/lib/db/queries.ts` `syncUserAndOrganization`: existing user → clerkOrgId → stripeCustomerId → new solo org. (Earlier bug: created duplicate orgs on first checkout — fixed in commit `edf340e`.)
- **Trial pattern:** 14-day trial on Starter plan, synthetic Stripe IDs until real checkout.
- **Webhook idempotency** dedupes on `email_messages.external_message_id` (Message-ID per RFC 5322).
- **Threading** uses In-Reply-To / References headers; OLDEST reference id is canonical. Closed threads (`resolved` / `escalated`) start fresh on next inbound.
- **Postgres enum gotcha:** `ALTER TYPE ADD VALUE` requires being outside a transaction. drizzle-kit push silently skips them — must run raw SQL in Neon for new enum values.

---

## What's built (Phase 5.5 complete)

- ✅ Org + user sync, trial creation, onboarding wizard
- ✅ Stripe checkout + portal + webhook (subscription_status, plan resolution)
- ✅ Inbox creation (`<slug>@mail.mailmind.se`), SendGrid inbound webhook
- ✅ Thread + message storage with idempotency
- ✅ AI draft pipeline (auto-triage on inbound, manual generate)
- ✅ Draft approve / edit / reject / send via Resend
- ✅ Internal notes per thread
- ✅ Reply templates (CRUD + insert via picker in draft editor)
- ✅ Stats dashboard (median response time via `PERCENTILE_CONT`)
- ✅ Bulk thread actions (multi-select)
- ✅ Audit log
- ✅ Health check endpoint at `/api/admin/health`

Latest commits:
- `f9ab3cc` — template picker + webhook idempotency
- `6528800` — internal notes + reply templates
- `edf340e` — syncUserAndOrganization duplicate-org fix
- `084265c` — UX polish (checklist, edit org, error boundaries)
- `ffa07b4` — stats dashboard + bulk actions

---

## Pending / Backlog

User-flagged interest, not yet built:
- **Snooze threads** — defer to later, surface back at chosen time
- **Tags on threads** — free-form labels for filtering
- **Customer history** — show all threads from same email address
- **Auto-classify case_type** at first AI call
- **Mobile responsivity** pass
- **Live Stripe keys** + **Resend Domain Auth** (manual ops, not code)

---

## Known caveats

- AI calls fail closed when over-limit (returns `skipped: <reason>`) — not retried automatically.
- No test suite yet. Don't introduce one without asking the user first.
- `.next` cache occasionally goes stale after directory moves — `rm -rf .next` fixes.
- PowerShell 5.1 doesn't support `-AsHashtable`; use `Invoke-RestMethod | ConvertTo-Json` for JSON output on user's Windows machine.

---

## Conventions for agents

- **Multi-tenant first.** Any new query without `organizationId` in WHERE is a leak. Reject in review.
- **Server before client.** Build repo function + route, then UI.
- **Don't commit unless asked.** User decides when to commit/push.
- **No new packages without checking package.json first.**
- **No README/*.md additions** unless user explicitly requests.
- **Schema changes:** update `src/lib/db/schema.ts`, tell user to run `npm run db:push`, output raw SQL for any enum value additions.

---

## How to update this file

When you finish a feature or make a meaningful decision, update the relevant section here as part of the same PR. Sections that drift fastest:
- "What's built" — add the new bullet, move from Pending if applicable
- "Latest commits" — keep top 5
- "Known caveats" — add anything future-you would want to know

Keep it terse. This is a state file, not docs.
