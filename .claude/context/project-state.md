# Mailmind — Project State

> **Shared context for all agents and contributors.**
> Read this FIRST at the start of any session. Update it after meaningful changes.
> If this file disagrees with the code, the code wins — but flag the drift.

---

## What Mailmind is

Swedish B2B SaaS that uses AI to triage customer-support email. Customer connects their Gmail account (OAuth) or forwards their support inbox to a unique `<slug>@mail.mailmind.se` address; we receive it, the AI classifies it and writes a draft reply; the agent reviews and sends with one click.

Target: Swedish SMBs (5–50 employees) drowning in support email who don't want a full Zendesk setup.

---

## Stack

| Concern | Tool |
|---|---|
| Framework | Next.js 16 App Router |
| Auth | Clerk (middleware in `proxy.ts`) |
| DB | Neon Postgres + Drizzle ORM 0.45 (HTTP serverless driver) |
| Billing | Stripe (checkout + portal + webhooks) |
| Inbound email | Gmail OAuth (Pub/Sub push) + SendGrid Inbound Parse → `/api/webhooks/sendgrid/inbound` |
| Outbound email | Gmail API (for Gmail-connected inboxes) + Resend (for forwarded inboxes) |
| AI | Anthropic SDK, `claude-haiku-4-5-20251001`, prompt caching (`cache_control: ephemeral`) |
| Hosting | Vercel |

Domain: `mailmind.se`. Inbound mail subdomain: `mail.mailmind.se`.

---

## Architectural ground truth

- **Multi-tenant.** Every read/write scoped by `organizationId`. Resolved server-side via `getCurrentAccount()` in `src/lib/app/entitlements.ts`. Never trust client-supplied org id.
- **Entitlement gating** in `src/lib/app/entitlements.ts` — `assertCanGenerateAiDraft`, `computeAccess`. Plan limits read from DB, never from client props.
- **Org sync priority** in `src/lib/db/queries.ts` `syncUserAndOrganization`: existing user → clerkOrgId → stripeCustomerId → new solo org.
- **Trial pattern:** 14-day trial on Starter plan, synthetic Stripe IDs until real checkout.
- **Webhook idempotency** dedupes on `email_messages.external_message_id` (UNIQUE index — `email_messages_external_id_uniq`). Must be created manually in Neon SQL Editor (not via db:push — existing duplicates blocked it).
- **Threading** uses In-Reply-To / References headers; OLDEST reference id is canonical. Closed threads (`resolved` / `escalated`) start fresh on next inbound.
- **Gmail OAuth tokens** stored AES-256-GCM encrypted in `inboxes.config` (JSONB). Key in `GMAIL_TOKEN_ENCRYPTION_KEY` env var.
- **Pub/Sub dedup** — stale historyId guard at top of push webhook; `findPendingDraft()` prevents duplicate drafts; UNIQUE index on `external_message_id` is the final backstop.
- **Draft dedup** — `findPendingDraft(threadId)` in `autoTriage.ts`: if a pending/edited draft already exists → skip generation.
- **AI price hallucination prevention** — `buildSystemPrompt()` in `ai.ts` has ABSOLUTA BEGRÄNSNINGAR: never estimate prices/costs/timelines not in KB; `source_grounded: true` only from KB or thread history.
- **`"use server"` constraint:** only `export async function` allowed — no exported constants. Constants shared between server/client live in separate files (e.g. `src/lib/app/constants.ts`).
- **Postgres enum gotcha:** `ALTER TYPE ADD VALUE` requires being outside a transaction. drizzle-kit push silently skips them — must run raw SQL in Neon for new enum values.

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
Fas 8  ✅  Stats, webhooks, snooze, search, onboarding-wizard, mobile-sidebar
Fas 9  ✅  Gmail OAuth — connect, receive, send via Gmail API + Pub/Sub push
Fas 10 ✅  Onboarding redesign — 5 obligatoriska steg + AI-kunskapsbas wizard
```

---

## Vad som gjorts sedan senast (Emil läser detta)

### Gmail OAuth (Fas 9) — klar
- Användare kopplar sitt Gmail-konto via `/api/app/inboxes/gmail/auth` → Google OAuth → callback
- Inkommande mail via Google Pub/Sub push till `/api/webhooks/gmail/push` (behöver `GMAIL_PUBSUB_TOPIC` i Vercel)
- Utgående svar skickas via Gmail API istället för Resend (tråd-id kopplas korrekt)
- Tokens krypterade med AES-256-GCM; kräver `GMAIL_TOKEN_ENCRYPTION_KEY` + `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` i Vercel

### AI-förbättringar
- Prompt hårdad: AI:n kan aldrig uppskatta priser/kostnader den inte hittar i kunskapsbasen
- Eskalerar istället med ett briefing-meddelande till agenten

### Onboarding (Fas 10) — ny 5-stegsdesign
Fil: `src/app/(portal)/app/onboarding/OnboardingForm.tsx`

**Steg 1 — Konto** (obligatorisk) — Företagsnamn  
**Steg 2 — Hemsida** (obligatorisk, men äkta "har ingen hemsida"-väg) — Scrape importerar KB-poster  
**Steg 3 — Ärendetyper** (obligatorisk, minst 1) — 4 förvalda + eget fält  
**Steg 4 — AI-beteende** (obligatorisk) — Ton, språk, max uppföljningsfrågor med förklaring  
**Steg 5 — Webhooks/Notifikationer** (valbar) — Förklaring i klartext + URL-fält  

Filosofi: ingen kan hoppa förbi obligatoriska steg. AI:n är fullkittad dag 1.

### Kunskapsbas-wizard
Fil: `src/app/(portal)/app/settings/KnowledgeSetupWizard.tsx`
- Steg 1: URL (valfritt) → scrape hemsida → importerar poster + använder innehållet som kontext
- Steg 2: AI (Haiku) genererar 8–12 branschspecifika frågor med hints
- Steg 3: Användaren fyller i svar → sparas som KB-poster
- API: `/api/app/knowledge/guided-setup` (generate_questions + save_answers)
- Scrape: `/api/app/knowledge/scrape` — 30+ poster, 16 000 teckens text-cap

### Settings-layout
- Inget `max-w-5xl` längre — full bredd
- Kunskapsbas-sektion är inte längre i tvåkolumns-grid

### AiSettingsEditor — fixad
- Select-dropdowns: `color-scheme: dark` + `option { background: #0a0f1e }` — vita dropdowns borta
- Etiketter översatta till svenska
- `hint`-prop på Field-komponenten för korta förklaringstexter

---

## Vad Emil behöver göra (manuella ops, ingen kod)

### Obligatoriskt innan riktiga kunder
1. **Live Stripe-nycklar** — byt `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` i Vercel. Registrera live webhook i Stripe → `https://mailmind.se/api/webhooks/stripe`.
2. **SendGrid Inbound Parse-MX** — MX för `mail.mailmind.se` → `mx.sendgrid.net` prio 10 i Loopia. Konfigurera Inbound Parse i SendGrid → URL `https://mailmind.se/api/webhooks/sendgrid/inbound`, hostname `mail.mailmind.se`.
3. **UNIQUE index i Neon** (om inte gjort) — kör detta i Neon SQL Editor:
   ```sql
   -- Ta bort eventuella dubbletter först
   DELETE FROM email_messages
   WHERE id NOT IN (
     SELECT DISTINCT ON (external_message_id) id
     FROM email_messages
     ORDER BY external_message_id, created_at ASC
   );
   -- Skapa unikt index
   CREATE UNIQUE INDEX IF NOT EXISTS email_messages_external_id_uniq
     ON email_messages (external_message_id)
     WHERE external_message_id IS NOT NULL;
   ```

### För Gmail-integration (om den ska erbjudas kunder)
4. **Google Cloud Pub/Sub** — sätt upp topic `mailmind-gmail-push` i Google Cloud Console, prenumeration med push-endpoint `https://mailmind.se/api/webhooks/gmail/push`. Lägg till `GMAIL_PUBSUB_TOPIC=projects/<projekt>/topics/mailmind-gmail-push` i Vercel.
5. **Google OAuth consent screen** — lägg till domän `mailmind.se` som authorized domain, skicka in för Google-verifiering (krävs för externa användare).

---

## Nästa kod-iteration (förslag)

### Prio 1 — Produkt-stabilitet
- **Microsoft 365 / Outlook OAuth** — låst beslut i CLAUDE.md: "Integration: Microsoft 365/Outlook först". Kan implementeras analogt med Gmail: OAuth → Graph API för mail → webhook subscriptions.
- **Autosvar-aktivering för riktiga kunder** — `DRY_RUN_THRESHOLD = 20` godkända dry-run-iterationer krävs. Admin-panelen visar progress.
- **Retry-logik för AI-anrop** — misslyckas just nu tyst. Lägg till enkel exponential backoff (max 2 försök).

### Prio 2 — Konvertering
- **Checklist på /app för nya användare** — påminn om att koppla inbox, fylla i KB, aktivera autosvar.
- **Email-rapport** — veckovis digest om inkorg-volym, AI-svarsprocent, eskaleringsfrekvens. Skickas via Resend.
- **Prissida-test** — A/B-test av pricing tiers (Starter vs Pro) när Stripe-keys är live.

### Prio 3 — Nice to have
- **Redigera ärendetyper från onboarding** — idag visas de i Settings men inte i en "bekräfta och redigera"-vy efteråt.
- **Inline KB-editor i tråden** — "Lägg till detta som kunskapssvar"-knapp direkt i thread-panelen.
- **Webhook-test-knapp** — skicka ett testanrop från Settings → Webhooks utan att vänta på ett riktigt mejl.

---

## Known caveats

- `usageCounters` skrivs från både `incrementAiDraftUsage` (manuell) och inline-upsert i `autoTriage.ts`. Båda konvergerar på `(organizationId, month)`.
- AI calls fail closed när over-limit — retries saknas.
- Inget test-suite. Introducera inte ett utan att fråga användaren.
- `.next`-cache kan bli stale efter directory moves — `rm -rf .next` löser.
- Windows: PowerShell 5.1 saknar `-AsHashtable`.

---

## Conventions for agents

- **Multi-tenant first.** Varje query utan `organizationId` i WHERE är en läcka.
- **Server before client.** Bygg repo-funktion + route, sedan UI.
- **Commit inte utan att bli ombedd.**
- **Inga nya npm-paket** utan att kolla `package.json` och motivera i commit-meddelandet.
- **Schema-ändringar:** uppdatera `src/lib/db/schema.ts`, säg till användaren att köra `npm run db:push`. Enum-tillägg kräver råa SQL-statements.
- **`"use server"`-filer:** bara `export async function` — inga exporterade konstanter.
- **Git-kommandon:** inkludera alltid `cd`-kommando före git-kommandon i PowerShell.
