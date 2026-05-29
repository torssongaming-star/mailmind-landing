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

> Detaljerade task-beskrivningar för Antigravity: **`docs/antigravity-tasks.md`**

```
Fas 1   ✅  Landing page + waitlist
Fas 2   ✅  Auth (Clerk) + org/user sync
Fas 3   ✅  Stripe billing (checkout, portal, webhooks, entitlements)
Fas 4   ✅  Inbox creation + SendGrid inbound
Fas 5   ✅  AI draft pipeline (auto-triage, manual generate, approve/send)
Fas 6a  ✅  Internal notes + reply templates
Fas 6b  ✅  Outlook sideload guide + manifest.xml (Mailbox 1.3)
Fas 6c  ✅  Dry-run pipeline + admin dry-run review UI
Fas 6d  ✅  Autosvar-pipeline (canAutoSend, executeSendDraft, AutoSendPanel)
Fas 6e  ⏳  Manuella ops — Live Stripe keys + SendGrid MX + Neon index (Emil, ingen kod)
Fas 7   ✅  Tags, blocklist-hook, inbox split-pane, settings sidebar, support drawer
Fas 8   ✅  Stats, webhooks, snooze, search, onboarding-wizard, mobile-sidebar
Fas 9   ✅  Gmail OAuth — connect, receive, send via Gmail API + Pub/Sub push
Fas 10  ✅  Onboarding redesign — 5 obligatoriska steg + AI-kunskapsbas wizard
Fas 11  ✅  Petitesser & fixar — cron, PII-logs, svenska strängar, admin-dashboard
Fas 12  ✅  Säkerhet & stabilitet — SendGrid HMAC, AI-retry, type safety + i18n (sv/en)
Fas 13  ✅  Microsoft 365 / Outlook OAuth (Graph API, AES-krypterade tokens, subscription-renewal i cron)
Fas 14  ✅  Veckovis e-postrapport — getWeeklyStats + notifyWeeklyReport i Monday-cron
Fas 15  ✅  Team & roller — orgInvites-tabell, invite-flow, TeamEditor UI, owner/admin/member-hierarki
Fas 16  ✅  Kundhistorik & AI-kontext — getCustomerHistory + injection i buildUserMessage
Fas 17  ✅  Prissättning & konvertering — AppBanners (trial-countdown, past-due, usage-warning)
Fas 18  ✅  PWA & mobilnotiser — manifest, service worker, Web Push (VAPID)
Fas 19  ✅  Säkerhetshärdning — Microsoft clientState, SendGrid HMAC obligatorisk, Stripe-hardfail, cron const-time-auth, open-redirect-fix, AI prompt-injection-skydd
Fas 20  ✅  Robusthet — rate limiting (AI/invite/webhook), security headers (CSP/HSTS/XFO), global-error-boundary, structured logger med PII-maskning
Fas 21  ✅  GDPR & datahygien — data-export-API, account-deletion 30d grace, cron-purge, retention 12mån, deletion-pending entitlement-gate
Fas 22  ✅  Produkt-polering — sidebar trial-badge, skeleton loaders (inbox/team), root 404, subscription-renewal alert
Fas 23  ✅  Legal & compliance — DPA, sub-processors, AUP, SLA, MSA, cookies, DPIA/ROPA, AI-disclaimer
Fas 24  ✅  Strategi-revisions kritiska fixar — P2.1 fejk-entitlements, P2.2 db hard-fail, P2.3 email_messages orgId, P2.4 Google Pub/Sub OIDC, P2.5 GMAIL key, P2.7 canAutoSend tests, P2.8 Stripe period_end, P2.9 audit PII, P2.11 cleanup, P3.3 prompt-inj, P3.4 AI_MODEL env, P5.4 trial_will_end, P5.1 UpgradePrompt, P6.3 Sentry, P6.5 security.txt, P7.5 DB index DESC
Fas S0  ✅  Quoting-plattformen: DB-scheman, entitlement-helper, produktregister, solar route-skelett, import-boundary lint, nav-switcher (QUOTING_NAV_ENABLED)
Fas S1  ✅  Quoting-common kernel: DB-scheman (8 tabeller), domäntyper, data-lager, state machine (OFF-YYYY-NNNN), API-routes (customers + quotes CRUD), Solar UI (dashboard, quotes, customers)
Fas S2  ✅  KB + klassificering + Solar-engine substrat: KB-schema (quoting_kb_entries), Solar DB-scheman (solar_properties, solar_quote_extension, solar_roi_scenarios), Solar ROI-motor (pure fn, SE-marknad, 14 tester), KB data-lager + domäntyper, Solar API-routes (calculate, properties CRUD), KB egress-gate (12 tester)
Fas S3  ✅  AI authoring layer: KB API-route, full egress-gate (rendered-text-scan), AI authoring layer (quoting-common/ai/), Solar prompt-fragment, Solar quote-builder UI (RoofSurfaceForm + RoiResultCard + quote-detalj)
Fas S4  ✅  KB admin-UI, printbart offertdokument (egress-skyddat), skicka-flöde (Resend + expiry-cron), Construction-vertikalskelett (engine + workspace), e-signering (publik token-gated offertvy)
```

---

### Fas S4 — Leveranslager: KB-admin, dokument, skicka, flervertikal, e-sign (klar 2026-05-29)

**S4-0 — Fix:** `src/lib/solar/engine/types.ts` var aldrig commitad (missades i S2-2) — nu spårad. Två tomma skräpfiler från en trasig shell-glob borttagna.

**S4-1 — KB admin-UI**
- `src/components/solar/KbManager.tsx`: client-island — lista/filtrera (alla/kundvänd/intern), skapa/redigera/ta bort via `/api/quoting/kb`. Synlighetsbadge (Globe=kund, Lock=intern), promotion-varning, useToast + ConfirmDialog. Skrivkontroller dolda för members. `vertical`-prop (default solar) gör den vertikal-agnostisk.
- `/solar/kb` + `/construction/kb` serveras av samma island.

**S4-2 — Printbart offertdokument**
- `/solar/quotes/[id]/document`: A4-print-optimerad kundvänd offert (narrativ + ROI-tabell + KB-highlights + giltighet). `runEgressGate` skannar sammansatt kundtext före render — narrativ undanhålls vid läcka. Print-to-PDF via `window.print()` (ingen PDF-dependency: sparar ~2 MB + cold-start).
- Builder: "Spara utkast" persisterar narrativ till `quote.meta` via PATCH; "Offertdokument"-länk.

**S4-3 — Skicka-flöde + expiry-cron**
- `POST /api/quoting/solar/quotes/[id]/send`: owner/admin, kräver kund-e-post, egress-gate före utskick, status via state machine (→ready→sent), workflow-event + audit (`quote_sent`). E-post via Resend (inline narrativ + ROI).
- `cron/tick` `taskExpireQuotes`: flippar sent/viewed-offerter förbi `validUntil` → expired (`quote_expired` audit).
- Builder: "Skicka till kund"-kort.

**S4-4 — Construction-vertikalskelett**
- `src/lib/construction/engine/`: `ConstructionEstimateInputSchema` + `runConstructionEstimate` (ren fn — material + arbete + moms + ROT på arbete, capad). `construction-estimate@1.0.0`. 7 tester.
- `/construction` (workspace, quotes, kb) — återanvänder hela quoting-common-stacken. Bevisar att kärnan är vertikal-agnostisk: bara motorn skiljer.
- `products.ts`: construction inte längre placeholder.

**S4-5 — E-signering (publik token-gated offertvy)**
- `src/lib/quoting-common/sharing/token.ts`: stateless HMAC-SHA256 share-tokens (ingen DB-tabell). Timing-safe verify; feature av om `QUOTE_SHARE_SECRET` saknas. 7 tester.
- `/q/[token]`: publik oautentiserad offertvy. HMAC verifieras före DB-läsning; egress-gate; sent→viewed open-tracking; accept-UI gated på status.
- `POST /api/public/quote/[token]/accept`: viewed→accepted→signed, signatur (namn+tid) i `quote.meta.signature`.
- Send-route persisterar vertikal-agnostisk `quote.meta.roiSummary` så publika vyn aldrig importerar en vertikal; mailar signeringslänk om konfigurerat.

**Verifiering (S4-6):** `typecheck` ✅ · `lint` ✅ · `test` 186/186 ✅ · `build` ✅

> **Inga DB-migrationer krävs för S4.** Share-tokens är stateless; Construction och meta-fält använder befintliga tabeller (`quoting_quotes.meta` JSONB).
>
> **Ny env (Sebastian, valfritt):**
> - `QUOTE_SHARE_SECRET` — aktiverar publika signeringslänkar (`/q/[token]`). Sätt en lång slumpsträng i Vercel. Utan den fungerar allt utom den publika länken (utskick sker fortfarande med inline-innehåll). Rotering ogiltigförklarar alla utestående länkar.
> - `NEXT_PUBLIC_APP_URL` — bas för länken (default `https://mailmind.se`, befintlig konvention).
>
> **DB-provisionering för att testa Construction:** lägg till en rad i `org_product_access` med `product_key='construction'`, `status='active'` för din org (annars redirectar `/construction` till `/app`).

---

### Fas S3 — AI authoring layer (klar 2026-05-29)

**S3-1 — KB API-routes**
- `GET/POST /api/quoting/kb` — list (member+) med optional vertical+visibility filter, create (admin/owner — defaults internal_only, audit-log kb_entry_created).
- `GET/PATCH/DELETE /api/quoting/kb/[id]` — PATCH skriver kb_entry_promoted audit-log vid internal_only → customer_facing promotion.
- `listCustomerFacingEntries` filterar hårt på visibility='customer_facing' i WHERE (strukturell enforcement §13.4).

**S3-2 — Full egress-gate (rendered-text-scan)**
- `runEgressGate(input, internalEntries): EgressResult` i `gate.ts`:
  - Rule 1: internal-data scan — 60-tecken-snippet case-insensitive match mot internalEntries.body.
  - Rule 2: placeholder-scan — `/\b(TODO|FIXME)\b/i` + `/\[FYLL I\]|\[INSERT\]|\[DATUM\]/i`.
- 19 vitest-tester — alla gröna. Fix: separerade `PLACEHOLDER_WORD_RE` + `PLACEHOLDER_BRACKET_RE` (word-boundary fungerade inte mot `[`).

**S3-3 — AI authoring layer**
- `src/lib/quoting-common/ai/types.ts`: AiDraftInput + AiDraftResult (client-safe).
- `src/lib/quoting-common/ai/author.ts`: `draftQuote()` — lazy Anthropic-klient, system-prompt med KB-poster (max 8) + prompt-fragment, `cache_control: ephemeral`, confidence < 0.6 → `low_confidence`, parse/API-fel → `parse_failed`. Aldrig throw.
- 5 vitest-tester med `vi.hoisted()` mock (inga riktiga API-anrop). Täcker happy path, low-confidence, parse-failure, promptFragments-injection, caller-injected kbEntries.

**S3-4 — Solar prompt-fragment + AI-draft endpoint**
- `src/lib/solar/ai-prompts/solar.ts`: SOLAR_PROMPT_FRAGMENTS — terminologi, beräkningskonventioner, narrativ stil (med platshållare för motor-tal), ROT-avdrag-påminnelse. Ren data, inga DB/app-imports.
- `POST /api/quoting/solar/draft`: auth → product-access → Zod → quote-check → listCustomerFacingEntries (audience-klassificerat) → draftQuote() → runEgressGate() → returnerar AiDraftResult med `egress_blocked`-flagga om grind utlöses.

**S3-5 — Solar quote-builder UI**
- `src/components/solar/RoofSurfaceForm.tsx`: dynamisk form med add/remove rader; per-rad Zod-validering med inline felmeddelanden.
- `src/components/solar/RoiResultCard.tsx`: KPI-tabell (produktion, egenanvändning, besparing, ROT, NPV, IRR, CO₂) + kondenserad 10-rads årstabel; positiva metrics i emerald.
- `src/app/(portal)/solar/quotes/[id]/SolarQuoteBuilder.tsx`: client-island state machine idle→calculating→calculated|error; POST /calculate + POST /draft; riskFlags som amber chips.
- `src/app/(portal)/solar/quotes/[id]/page.tsx`: server page med auth+product gate; hämtar quote + kundnamn; renderar builder.
- `/solar/quotes` offertlista: offert-nummer är nu klickbara länkar till detalj-sidan.

**Verifiering (S3-6):** `typecheck` ✅ · `lint` ✅ · `test` 172/172 ✅

---

### Fas S4 — (planeras)

Förslag på nästa fas (diskutera med Sebastian innan start):

**S4-1 — KB admin-UI**
- Lista, skapa, redigera och promota KB-poster i portalen (`/solar/kb` eller `/settings/kb`).
- Visuell distinktion internal_only vs customer_facing; audit-log-vy för promotions.

**S4-2 — Solar-offert PDF**
- Generera en kundvändande PDF med narrativeText + ROI-nyckeltal + logo.
- Egress-gate körs alltid innan PDF skapas.
- Förslag: `@react-pdf/renderer` (motivering i commit om det väljs).

**S4-3 — Offert-skicka-flöde**
- Status-transition `ready → sent` via API.
- Skicka PDF-länk till kund via e-post (Resend).
- Quote `validUntil` ger cron-jobb för `sent → expired`.

**S4-4 — Construction/Trades vertikals-skelett**
- Analogt med Solar: engine-stub, prompt-fragment, quote-builder, API-routes.
- Primärt: möjliggör flervertikal demo för enterprise-leads.

**S4-5 — Offert-signering (e-signatur)**
- Enkel "godkänn offert"-länk med token (ingen tredjepartstjänst i MVP).
- Status-transition `sent/viewed → accepted → signed`.

---

## Återstår från strategi-revisionen

Marketing/analytics som kräver konton:
- P1.1 PostHog (kräver konto/API-key)
- P1.4 A/B middleware (efter beslut: behåll / eller v2)
- P5.2 Annual pricing (kräver Stripe-price-IDs)
- P6.4 IP-restriktion admin (kräver IP-lista)

Större arbete (1+ vecka):
- P1.7 Interaktiv landing-demo
- P3.1 LLM-as-judge confidence-validator
- P3.5 pgvector KB-retrieval
- P3.6 Källhänvisning i drafts
- P7.3 Task-kö (QStash/Vercel Queues)
- P2.6 Upstash Redis rate-limit
- Fas 4 enterprise: SSO/SAML, SOC 2, etc

---

## Vad som gjorts sedan senast (Emil läser detta)

### Fas S2 — KB + klassificering + Solar-engine substrat (klar 2026-05-29)

**S2-1 — Solar DB-scheman + KB-schema**
- `src/lib/db/schema.solar.ts`: `solar_properties`, `solar_quote_extension` (1:1 unik mot quote), `solar_roi_scenarios` (append-only, versioned engine output).
- `src/lib/db/schema.quoting.ts`: `quoting_kb_entries` + `kbCategoryEnum` + `kbVisibilityEnum` (default `internal_only` — fail-safe §13.4).
- Re-exporterade från `src/lib/db/schema.ts`.

**S2-2 — Solar ROI-motor**
- `src/lib/solar/engine/types.ts`: `SolarEngineInputSchema` (Zod, SE-marknadens defaults), `SolarEngineResult`, `YearlyDataPoint`, `ENGINE_VERSION = "solar-roi@1.0.0"`.
- `src/lib/solar/engine/roi.ts`: `runSolarRoi(input): SolarEngineResult` — ren deterministisk funktion. kWp-baserad produktion med PVGIS-kalibrerade tilt/azimut-tabeller (59°N), Quaschning self-consumption, DCF (NPV + IRR bisection), ROT-avdrag, CO₂ (0.045 kg/kWh).
- 14 vitest-tester — alla gröna.

**S2-3 — KB data-lager**
- `KbEntry`, `KbCategory`, `KbVisibility`, `CreateKbEntryInput`, `UpdateKbEntryInput` tillagda i `domain/types.ts`.
- `src/lib/quoting-common/data/kb.ts`: listKbEntries, listCustomerFacingEntries (audience-gated), getKbEntry, createKbEntry (default internal_only), updateKbEntry, deleteKbEntry.

**S2-4 — Solar API-routes**
- `src/lib/solar/data/properties.ts` — CRUD för solar_properties.
- `src/lib/solar/data/scenarios.ts` — append + query solar_roi_scenarios.
- `POST /api/quoting/solar/calculate` — validerar input → kör motor → persist versioned scenario.
- `GET/POST /api/quoting/solar/properties` — list + create.
- `GET/PATCH/DELETE /api/quoting/solar/properties/[id]` — CRUD per property.
- ESLint-fix: separerade Rule 2 (cross-vertical imports) från Rule 4 (DB-direkt) — `src/lib/<v>/data/**` undantagna från DB-direktimport-restriktionen.

**S2-5 — KB egress-gate**
- `src/lib/quoting-common/egress/gate.ts`: filterCustomerFacing, isCustomerFacing, extractBodies (med vertical-scope + maxEntries), auditBlocked.
- Fail-safe: okänd/internal_only blockeras alltid. 12 vitest-tester — alla gröna.

**Verifiering (S2-6):** `typecheck` ✅ · `lint` ✅ · `test` 160/160 ✅ · `build` ✅

---

### Fas S1 — Quoting-common kernel (klar 2026-05-29)

**S1-1 — DB-scheman**
- `src/lib/db/schema.quoting.ts`: 8 nya tabeller — `quoting_quote_number_sequences`, `quoting_customers`, `quoting_products`, `quoting_price_books`, `quoting_price_book_versions`, `quoting_quotes` (med `vertical`-diskriminator + `quoteStatusEnum`), `quoting_quote_lines`, `quoting_workflow_events`.
- Nya enums: `priceBookStatusEnum`, `quoteStatusEnum`.

**S1-2 — Domäntyper + data-lager**
- `src/lib/quoting-common/domain/types.ts` — rena TS-typer (client-säkra).
- `src/lib/quoting-common/data/customers.ts` — listCustomers, getCustomer, createCustomer, updateCustomer.
- `src/lib/quoting-common/data/products.ts` — listProducts, getProduct, listPriceBooks, getLatestPublishedVersion.
- `src/lib/quoting-common/data/quotes.ts` — fullständigt CRUD + quote-lines + workflow-events.

**S1-3 — State machine + numrering**
- `src/lib/quoting-common/domain/quote-state.ts` — QUOTE_TRANSITIONS, canTransition, allowedTransitions, isTerminal (pure functions).
- `src/lib/quoting-common/data/quote-number.ts` — atomisk OFF-YYYY-NNNN via upsert+increment.
- 20 vitest-tester, alla gröna.

**S1-4 — API-routes**
- `GET/POST /api/quoting/customers` — list + create.
- `GET/POST /api/quoting/quotes` — list + create (number auto-assigned).
- `GET/PATCH/DELETE /api/quoting/quotes/[id]` — detail, update med `canTransition`-validering, soft-delete.

**S1-5 — Solar workspace UI**
- `QuoteStatusBadge` — color-coded status-chip.
- `/solar` — dashboard med summary cards.
- `/solar/quotes` — offerttabell.
- `/solar/customers` — kundtabell.

**Verifiering:** `typecheck` ✅ · `lint` ✅ · `test` 134/134 ✅ · `build` ✅

> **DB-migration för S2** — kör i Neon SQL Editor (Sebastian):
> ```sql
> -- Enums
> CREATE TYPE kb_category AS ENUM ('faq','policy','spec','caveat','other');
> CREATE TYPE kb_visibility AS ENUM ('internal_only','customer_facing');
>
> -- quoting_kb_entries
> CREATE TABLE quoting_kb_entries (
>   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
>   organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
>   title varchar(300) NOT NULL,
>   body text NOT NULL,
>   category kb_category NOT NULL DEFAULT 'other',
>   visibility kb_visibility NOT NULL DEFAULT 'internal_only',
>   vertical varchar(50),
>   source varchar(200),
>   created_by uuid,
>   created_at timestamptz NOT NULL DEFAULT now(),
>   updated_at timestamptz NOT NULL DEFAULT now()
> );
> CREATE INDEX ON quoting_kb_entries (organization_id);
> CREATE INDEX ON quoting_kb_entries (organization_id, vertical);
> CREATE INDEX ON quoting_kb_entries (organization_id, visibility);
>
> -- solar_properties
> CREATE TABLE solar_properties (
>   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
>   organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
>   customer_id uuid REFERENCES quoting_customers(id) ON DELETE SET NULL,
>   address jsonb,
>   roof_surfaces jsonb NOT NULL DEFAULT '[]',
>   imagery_source varchar(50),
>   imagery_ref jsonb,
>   created_at timestamptz NOT NULL DEFAULT now(),
>   updated_at timestamptz NOT NULL DEFAULT now()
> );
> CREATE INDEX ON solar_properties (organization_id);
> CREATE INDEX ON solar_properties (customer_id);
>
> -- solar_quote_extension
> CREATE TABLE solar_quote_extension (
>   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
>   organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
>   quote_id uuid NOT NULL REFERENCES quoting_quotes(id) ON DELETE CASCADE,
>   property_id uuid REFERENCES solar_properties(id) ON DELETE SET NULL,
>   meta jsonb,
>   created_at timestamptz NOT NULL DEFAULT now(),
>   updated_at timestamptz NOT NULL DEFAULT now()
> );
> CREATE UNIQUE INDEX ON solar_quote_extension (quote_id);
> CREATE INDEX ON solar_quote_extension (organization_id);
>
> -- solar_roi_scenarios
> CREATE TABLE solar_roi_scenarios (
>   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
>   organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
>   quote_id uuid NOT NULL REFERENCES quoting_quotes(id) ON DELETE CASCADE,
>   engine_version varchar(50) NOT NULL,
>   inputs jsonb NOT NULL,
>   results jsonb NOT NULL,
>   created_at timestamptz NOT NULL DEFAULT now()
> );
> CREATE INDEX ON solar_roi_scenarios (quote_id);
> CREATE INDEX ON solar_roi_scenarios (organization_id);
> ```

---

### Fas S0 — Quoting-plattformens fundament (klar 2026-05-29)

Alla S0-tasks (S0-1 → S0-7) levererade. Kortfattat:

**S0-1 — DB-scheman**
- `src/lib/db/schema.quoting.ts`: tre nya tabeller — `products` (registry), `org_product_access` (entitlements per tenant, enum `trialing|active|disabled`), `quoting_usage_counters` (vertikala usage-räknare per org+månad).
- Re-exporterade från `src/lib/db/schema.ts` så Drizzle ser dem i samma schema-objekt.
- Tabellerna skapades i Neon via SQL (Sebastian kör).

**S0-2 — Entitlement-helper**
- `AccountSnapshot` utvidgad med `products: Record<string, { status, limits }>`.
- Ny helper `hasProductAccess(account, key): boolean` — `true` för `active`/`trialing`, `false` annars.
- `src/lib/db/queries.ts` hämtar `org_product_access` parallellt i `getPortalData`.
- 6 vitest-tester i `src/lib/app/entitlements.products.test.ts` — alla gröna.

**S0-3 — Produktregister**
- `src/config/products.ts`: `PRODUCTS`-registry med `mail`, `solar`, `construction` (placeholder), `trades` (placeholder). `as const satisfies` för full typinferens.
- `drizzle/seed-products.sql`: idempotenta INSERTs i Neon (Sebastian kör).

**S0-4 — Solar route-skelett**
- `src/app/(portal)/solar/layout.tsx`: auth → account → `hasProductAccess('solar')`-gate → redirect `/app` om icke-entitled.
- `src/app/(portal)/solar/page.tsx`: placeholder-dashboard.

**S0-5 — Import-boundary lint**
- `eslint.config.mjs`: fyra `no-restricted-imports`-regelblock som speglar §3.4:
  - Plattformskärnan får inte importera vertikaler/quoting-common.
  - Quoting-common får inte importera vertikaler.
  - Vertikaler får inte importera varandras syskon.
  - Routes/API-routes får inte gå runt datalagret direkt till `@/lib/db`.

**S0-6 — Nav-switcher**
- `src/components/portal/ProductSwitcher.tsx`: async server component — filtrerar PRODUCTS på `!placeholder && hasProductAccess`, renderar workspace-länkar. Dold om < 2 entries.
- Portal-layouten monterar switchern bakom `QUOTING_NAV_ENABLED=1`.
- Sidebar-klienten tar `productSwitcher?: React.ReactNode` slot.

**LOI verify — bonus**
- `src/app/loi/verified/page.tsx`: dedikerad välkomstsida efter e-postbekräftelse ("Välkommen till framtiden."). Energisk, professionell, ingen retur till formulärsidan.
- `src/app/api/loi/verify/route.ts`: success redirect ändrad till `/loi/verified` (error-redirect till `/loi?verified=…` oförändrad).

**Verifiering (S0-7):** `typecheck` ✅ · `lint` ✅ · `test` 114/114 ✅ · `build` ✅



### Strategi-revision P2.1 — riktiga limit-räknare (klar)
- `src/lib/app/entitlements.ts`: `AccountSnapshot` har nu fälten `inboxesUsed` och `usersUsed` som räknas via två parallella `COUNT(*)` mot `inboxes` resp. `users` med `organizationId` i WHERE. Tidigare hårdkodade `0`/`1` → inbox- och seat-limit höll aldrig.
- Nya helpers: `assertCanAddInbox(clerkUserId)` och `assertCanInviteUser(clerkUserId)` (samma mönster som `assertCanGenerateAiDraft`).
- `computeAccess()` tar `inboxesUsed`/`usersUsed` som input och blockerar exakt vid `limit + 1`. Reason-koder: `inbox_limit_reached`, `user_limit_reached`.
- Konsumeras av `src/app/api/app/inboxes/route.ts` (POST) och `src/app/api/app/team/route.ts` (POST) via `account.access.canAddInbox` / `canInviteUser`.
- Tester: `src/lib/app/entitlements.test.ts` — 24 vitest-tester verifierar att gränsen blockas vid limit+1, role-gating för invites, `deletion_pending` / `past_due` / `cancelled` policy, AI-draft-limit och `hasRole`.
- Ingen DB-migration krävs — bara nya queries mot befintliga tabeller.

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

## Boot-time

- `src/instrumentation.ts` finns, initierar Sentry (via `sentry.server.config`) och validerar env vid start: `DATABASE_URL`, `CLERK_SECRET_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY` krävs alltid (`assertSet`); `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, `ADMIN_HEALTH_SECRET`, `GMAIL_PUSH_OIDC_AUDIENCE` krävs i produktion (`requireInProduction`). Cold start failar tidigt vid misskonfigurerad deploy.

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
- **Commita automatiskt** när en task är klar och verifieringen är grön — ett commit per task, beskrivande meddelande. Aldrig secrets, .env eller debug-scripts i roten.
- **Inga nya npm-paket** utan att kolla `package.json` och motivera i commit-meddelandet.
- **Schema-ändringar:** uppdatera `src/lib/db/schema.ts`, säg till användaren att köra `npm run db:push`. Enum-tillägg kräver råa SQL-statements.
- **`"use server"`-filer:** bara `export async function` — inga exporterade konstanter.
- **Git-kommandon:** inkludera alltid `cd`-kommando före git-kommandon i PowerShell.
