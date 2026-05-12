# Mailmind — Project State

> **Shared context for all agents and contributors.**
> Read this FIRST at the start of any session. Update it after meaningful changes.
> If this file disagrees with the code, the code wins — but flag the drift.

---

## What Mailmind is

Swedish B2B SaaS that uses AI to triage customer-support email. Customer forwards their support inbox to a unique `<slug>@mail.mailmind.se` address; we receive it, the AI classifies it (`ask` / `summarize` / `escalate`) and writes a draft reply; the agent reviews and sends with one click.

Target: Swedish SMBs (5–50 employees) drowning in support email who don't want a full Zendesk setup.

---

## Stack

| Concern | Tool |
|---|---|
| Framework | Next.js 16 App Router |
| Auth | Clerk (middleware in `proxy.ts`) |
| DB | Neon Postgres + Drizzle ORM 0.45 (HTTP serverless driver) |
| Billing | Stripe (checkout + portal + webhooks) |
| Inbound email | SendGrid Inbound Parse → `/api/webhooks/sendgrid/inbound` |
| Outbound email | Resend |
| AI | Anthropic SDK, `claude-haiku-4-5-20251001`, prompt caching (`cache_control: ephemeral`) |
| Hosting | Vercel |

Domain: `mailmind.se`. Inbound mail subdomain: `mail.mailmind.se`.

---

## Architectural ground truth

- **Multi-tenant.** Every read/write scoped by `organizationId`. Resolved server-side via `getCurrentAccount()` in `src/lib/app/entitlements.ts`. Never trust client-supplied org id.
- **Entitlement gating** in `src/lib/app/entitlements.ts` — `assertCanGenerateAiDraft`, `computeAccess`. Plan limits read from DB, never from client props.
- **Org sync priority** in `src/lib/db/queries.ts` `syncUserAndOrganization`: existing user → clerkOrgId → stripeCustomerId → new solo org. (Earlier bug: duplicate orgs on first checkout — fixed `edf340e`.)
- **Trial pattern:** 14-day trial on Starter plan, synthetic Stripe IDs until real checkout.
- **Webhook idempotency** dedupes on `email_messages.external_message_id` (Message-ID per RFC 5322).
- **Threading** uses In-Reply-To / References headers; OLDEST reference id is canonical. Closed threads (`resolved` / `escalated`) start fresh on next inbound.
- **Postgres enum gotcha:** `ALTER TYPE ADD VALUE` requires being outside a transaction. drizzle-kit push silently skips them — must run raw SQL in Neon for new enum values.
- **`"use server"` constraint:** only `export async function` allowed — no exported constants. Constants shared between server/client live in separate files (e.g. `src/lib/app/constants.ts`).
- **`usageCounters` not yet written to** — AI draft counts are always read from `aiDrafts` table directly (`getOrgHealth()` does this). The `usageCounters` rows exist but stay at 0 until Phase 3 wires up the increment logic.

---

## Phase roadmap

```
Fas 1  ✅  Landing page + waitlist
Fas 2  ✅  Auth (Clerk) + org/user sync
Fas 3  ✅  Stripe billing (checkout, portal, webhooks, entitlements)
Fas 4  ✅  Inbox creation + SendGrid inbound
Fas 5  ✅  AI draft pipeline (auto-triage, manual generate, approve/send)
Fas 6a ✅  Internal notes + reply templates
Fas 6b ✅  Outlook sideload guide + manifest.xml (Mailbox 1.3)
Fas 6c ✅  Dry-run pipeline + admin dry-run review UI
Fas 6d ✅  Autosvar-pipeline (canAutoSend, executeSendDraft, AutoSendPanel)
Fas 6e ⏳  Manuella ops — Live Stripe keys + Resend DNS (Emil, no code)
Fas 7  ✅  Tags, blocklist-hook, inbox split-pane, settings sidebar, support drawer
Fas 8  🔲  Kundhistorik, snooze-cron, trådsökning, webhook delivery log, stats-sida
```

---

## What's built (current — after Fas 7)

### Core product
- ✅ Org + user sync, trial creation, onboarding wizard
- ✅ Stripe checkout + portal + webhook (subscription_status, plan resolution)
- ✅ Inbox creation (`<slug>@mail.mailmind.se`), SendGrid inbound webhook
- ✅ Thread + message storage with idempotency
- ✅ AI draft pipeline (auto-triage on inbound, manual generate)
- ✅ Draft approve / edit / reject / send via Resend
- ✅ Internal notes per thread
- ✅ Reply templates (CRUD + insert via picker in draft editor)
- ✅ Snooze threads (`snoozedUntil` column, `SnoozeButton` component — **no cron yet**)
- ✅ Tags on threads (jsonb column, `TagEditor` chip component, filter in inbox)
- ✅ Block sender (`BlockSenderButton` on thread + inbox split-pane)
- ✅ Blocklist wired into `canAutoSend()` (was hardcoded `false`)
- ✅ Stats dashboard (`/app/stats`)
- ✅ Activity log (`/app/activity`)
- ✅ Bulk thread actions (multi-select in inbox)
- ✅ Audit log

### Autosvar-pipeline (Fas 6c–6d)
- ✅ Dry-run pipeline — AI genererar drafts utan att skicka
- ✅ Dry-run review UI at `/admin/organizations/[id]/dry-run`
- ✅ `canAutoSend()` — 4 hårt låsta regler (confidence ≥ 90%, källgrundat, låg risk, ej blockerad)
- ✅ `executeSendDraft()` — delad send-logik för manuell + auto
- ✅ AI output utökad med `confidence`, `risk_level`, `source_grounded`
- ✅ `AutoSendPanel` — admin-toggle, säkerhetslåst tills ≥ 20 godkända dry-run-iterationer
- ✅ `DRY_RUN_THRESHOLD = 20` i `src/lib/app/constants.ts`

### Portal UI (Fas 7 + polish)
- ✅ Inbox: Gmail-style split-pane (`InboxShell` + `ThreadPanel`), auto-poll 30s
- ✅ Settings: Vercel/Linear-style vertical sidebar (`SettingsTabs`), instant tab-switch
- ✅ Support: slide-in drawer (`SupportDrawer`) med FAQ-accordion + kontaktformulär
  - POST `/api/app/support` → Resend → support@mailmind.se, rate-limit 3/h/org
- ✅ Portal sidebar: grupperad nav med kollapsbar dropdown, `bestActiveChildHref()` för korrekt markering
- ✅ Kunskapsbas, Svarsmallar, Blocklista, Webhooks — alla i Settings

### Admin-panel
- ✅ `/admin/onboarding` — `ProvisionForm`: skapar org + trial + entitlements + case types + AI-inställningar i ett steg
- ✅ `/admin/organizations` — lista med subscription/status
- ✅ `/admin/organizations/[id]` — detalj: hälsometrics (threads, AI-drafts denna månad, senaste aktivitet), billing, usage, members, dry-run-panel, auto-send-panel, internal notes
  - `OrgNotesPanel` (client) — sparar anteckningar live
  - `OrgProfilePanel` (client) — Change Status + Update Profile, sparar till `adminCustomerProfiles`
  - `getOrgHealth()` — räknar trådar + AI-drafts direkt från `aiDrafts` (inte `usageCounters`)
- ✅ `/admin/pilots` — lista leads, `NewPilotModal` + `EditPilotModal` (inkl. `nextFollowUpAt`)
- ✅ Admin-panel responsiv (mobile-fix i Emil's branch)
- ✅ Outlook sideload-guide (`/admin/sideload`)

---

## Pending / Fas 6e (Emil — manuella ops, ingen kod)

> Måste vara klart innan riktiga kunder kan betala och ta emot autosvar.

1. **Live Stripe-nycklar** — byt `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` i Vercel. Registrera live webhook-endpoint i Stripe dashboard → `https://mailmind.se/api/webhooks/stripe`.
2. **Resend domänverifiering** — lägg till SPF/DKIM DNS-poster för `mail.mailmind.se` i Resend dashboard och bekräfta "Verified".

---

## Fas 8 backlog (nästa kod-iteration)

Prioritetsordning:

1. **Snooze-cron** — `/api/cron/unsnooze` som resettar `status → open` för trådar där `snoozedUntil <= now()`. Vercel Cron i `vercel.json`, kör var 15:e minut. Lägg till "Snoozade" filter i `InboxFilters`.
2. **Kundhistorik-panel** — kollapsbar sektion på tråd-sidan: "Historik från denna avsändare" — 10 senaste trådar från samma `fromEmail`. Ingen ny DB-kolumn.
3. **Trådsökning** — sökruta i inbox-header, `/api/app/threads/search?q=`, Postgres `ILIKE` på subject + fromEmail, debounce 300 ms.
4. **Prompt-caching per org** — `cache_control: { type: "ephemeral" }` på system-blocket i `src/lib/app/ai.ts`. Kommentar finns i filen. Mäter på hög volym.
5. **Stats-sida fyll ut** — `/app/stats` finns men är tunn. Lägg till: trådar/dag (bar chart, Recharts redan installerat), caseType-fördelning (donut), autosvar vs manuell andel. Serverside SQL-aggregat.
6. **Webhook delivery log** — ny tabell `webhook_deliveries` (`id`, `endpointId`, `threadId`, `statusCode`, `sentAt`, `error`). Skriv till den i `triggerWebhooks()`. Visa i `WebhooksEditor`.
7. **Onboarding steg 2** — "Testa anslutningen": kunden skickar testmejl, sidan pollar `/api/app/threads?inboxId=X&limit=1` var 2s i max 60s, visar "✓ Anslutning verifierad!".
8. **Kunskapsbas-scraping** — `/api/app/knowledge/scrape` (POST `{ url }`): fetch + cheerio (lägg till paket), extrahera h2/h3 + närmaste p som FAQ-par, spara via `createKnowledge()`. Max 30 par.
9. **Mobilanpassning portal** — `Sidebar` är `hidden` under `lg:`. Bygg `MobileSidebar` med hamburger + slide-in (samma mönster som `SupportDrawer`).

---

## Latest commits (top 8)

```
8ae1642  fix(admin): add nextFollowUpAt to Edit Profile modal
39c8c13  feat(admin): wire up Edit Profile button on pilot leads
d0de5e9  fix(admin): remove aiSettings from org query (not in relations → 404)
550f367  fix(admin): fix 0 AI usage, OrgNotesPanel, OrgProfilePanel, NewPilotModal
270522d  Fix: Missing auditLogs import in admin queries
384eee2  Fix: Organization health metrics and activity tracking
9cdb4d0  fix(sidebar): SupportDrawer always-open bug + grouped collapsible nav
7d46835  feat: replace mailto: Support link with in-app slide-in drawer
```

---

## Known caveats

- `usageCounters` är aldrig inkrementerad — läs alltid AI-usage från `aiDrafts` direkt.
- `aiSettings` saknar relation på `organizations` — lägg INTE till `aiSettings: true` i `db.query.organizations.findFirst({ with: ... })`, det crashar tyst och ger 404.
- AI calls fail closed när over-limit (returnerar `skipped: <reason>`) — retries saknas.
- Inget test-suite. Introducera inte ett utan att fråga användaren först.
- `.next`-cache kan bli stale efter directory moves — `rm -rf .next` löser.
- Windows: PowerShell 5.1 saknar `-AsHashtable`; använd `Invoke-RestMethod | ConvertTo-Json`.

---

## Conventions for agents

- **Multi-tenant first.** Varje query utan `organizationId` i WHERE är en läcka. Avvisa i review.
- **Server before client.** Bygg repo-funktion + route, sedan UI.
- **Commit inte utan att bli ombedd.**
- **Inga nya npm-paket** utan att kolla `package.json` och motivera i commit-meddelandet.
- **Inga README/*.md-tillägg** om inte användaren explicit ber om det.
- **Schema-ändringar:** uppdatera `src/lib/db/schema.ts`, säg till användaren att köra `npm run db:push`. Enum-tillägg kräver råa SQL-statements.
- **`"use server"`-filer:** bara `export async function` — inga exporterade konstanter.
- **Sessionsdisciplin:** håll sessioner fokuserade på en fas/feature. Uppdatera denna fil när fasen är klar.
