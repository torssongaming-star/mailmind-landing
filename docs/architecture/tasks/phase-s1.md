# Fas S1 — Quoting-common kernel · task-pack

> **För:** Sebastian + Claude (Claude Code). Varje task är skriven så att Claude kan komma in i en **fräsch session utan minne av tidigare arbete** och utföra uppgiften självständigt.
> **Refererar:** `docs/architecture/quoting-platform-architecture.md` §3, §6.2, §8.1, §11.
> **Förutsättning:** Fas S0 är klar och verifierad (ADR 0002). Alla S0-tasks är committade.
> **Beslut som låser S1:** B1 (quoting_customers i quoting-common ✅), B4 (OFF-YYYY-NNNN numrering ✅), B9 (universell quoting_products ✅) — alla Decided i ADR 0001.
>
> **S1 levererar:** Det vertikalagnostiska offert-kärnan som Solar, Construction och Trades alla bygger ovanpå. Inga vertikal-specifika motorer i S1 — det är S2+. S1 är infrastrukturen som håller en offert ihop: kunder, produktkatalog, prislistor, offertaggregat med rader, workflow-logg och numrering.

---

## Hur du (Sebastian) använder detta dokument

1. Välj **en** task (S1-1 → S1-6 i ordning — de är beroende).
2. Säg: `Kör S1-X enligt docs/architecture/tasks/phase-s1.md`.
3. Claude läser task-specen + referensfilerna, gör arbetet, kör verifieringen, presenterar diffen.
4. Du granskar → godkänner eller ber om justering.
5. Claude committar automatiskt per task och uppdaterar project-state.md i S1-6.

---

## S1-1 · DB-scheman: quoting-common kernel-tabeller

- **§-ref:** §6.2, §6.5, §6.6
- **Storlek:** M (~60 min)
- **Läs först:**
  - `src/lib/db/schema.quoting.ts` (befintliga tabeller från S0 — vi *lägger till* i samma fil)
  - `src/lib/db/schema.ts` rad 1–60 (konventioner: pgEnum, uuid PK, timestamptz, index-mönster)
  - `docs/architecture/decisions/0001-blocking-decisions.md` §B1, §B4, §B9 (bekräfta Decided)
- **Ändrar / skapar:**
  - **Ändrar:** `src/lib/db/schema.quoting.ts` — lägg till följande tabeller i slutet av filen (efter befintliga S0-tabeller):
    - `quoting_quote_number_sequences` — `(id, organizationId FK, year int, lastUsed int, uniqueIdx(organizationId, year))` — stöder atomisk OFF-YYYY-NNNN-numrering (B4).
    - `quoting_customers` — `(id, organizationId FK cascade, name, orgNumber varchar NULL, email varchar NULL, phone varchar NULL, address jsonb NULL, sharedContactId uuid NULL, meta jsonb, createdAt, updatedAt; idx(organizationId))`.
    - `quoting_products` — `(id, organizationId FK cascade, kind varchar, verticals jsonb $type<string[]>, sku varchar NULL, name, spec jsonb NULL, cost numeric NULL, active bool default true, createdAt, updatedAt; idx(organizationId), idx(organizationId, kind))`.
    - `quoting_price_books` — `(id, organizationId FK cascade, name, currency varchar default 'SEK', status priceBookStatusEnum, verticals jsonb $type<string[]>, createdAt, updatedAt; idx(organizationId))` — enum: `draft|published|archived`.
    - `quoting_price_book_versions` — `(id, organizationId FK cascade, priceBookId FK cascade, version int, effectiveFrom date, items jsonb, publishedAt timestamptz NULL, createdBy uuid NULL; uniqueIdx(priceBookId, version))`.
    - `quoting_quotes` — `(id, organizationId FK cascade, customerId FK→quoting_customers NULL, vertical varchar NOT NULL, number varchar NULL, status quoteStatusEnum, priceBookVersionId FK→quoting_price_book_versions NULL, currency varchar default 'SEK', subtotal numeric NULL, vatAmount numeric NULL, rotDeduction numeric NULL, rutDeduction numeric NULL, total numeric NULL, validUntil date NULL, assignedUserId uuid NULL, meta jsonb NULL, createdBy uuid NULL, createdAt, updatedAt; idx(organizationId), idx(organizationId, status), idx(organizationId, vertical), uniqueIdx(organizationId, number) WHERE number IS NOT NULL)` — enum: `draft|calculating|ready|sent|viewed|accepted|signed|rejected|expired`.
    - `quoting_quote_lines` — `(id, organizationId FK cascade, quoteId FK→quoting_quotes cascade, productId uuid NULL, description, qty numeric, unitPrice numeric, lineTotal numeric, sortOrder int default 0, meta jsonb NULL; idx(quoteId), idx(organizationId))`.
    - `quoting_workflow_events` — `(id, organizationId FK cascade, quoteId FK→quoting_quotes cascade, fromStage varchar NULL, toStage varchar, actorUserId uuid NULL, reason varchar NULL, createdAt timestamptz default now(); idx(quoteId), idx(organizationId, createdAt))`.
  - **Ändrar:** `src/lib/db/schema.ts` — re-exportera de nya typerna (lägg till de nya tabell-namnen i befintlig re-export från schema.quoting.ts, matcha mönstret för S0-tabellerna).
- **Rör inte:** befintliga S0-tabeller (`products`, `org_product_access`, `quoting_usage_counters`). Inga solar_*-tabeller (de är S2). Inga ändringar i mail-scheman.
- **AC:**
  - `npm run typecheck` passerar.
  - `npm run db:generate` producerar en migration utan fel.
  - Alla åtta nya tabeller exporteras korrekt från `schema.quoting.ts`.
  - Inga cirkulära imports.
- **Verifiering:** `npm run typecheck && npm run lint`
- **Out-of-scope:** Drizzle-queries, service-lager, API-routes, UI. Enbart schema.

---

## S1-2 · Quoting-common data-lager + domäntyper

- **§-ref:** §3.1, §6.2, §11
- **Storlek:** M (~60 min)
- **Läs först:**
  - `src/lib/db/schema.quoting.ts` (S1-1 resultatet — alla tabeller vi ska quereja)
  - `src/lib/db/queries.ts` (befintliga Drizzle-queries — konventioner: `eq`, `and`, `desc`, parametrar)
  - `src/lib/app/entitlements.ts` `getCurrentAccount` (hur vi löser org)
  - Mappen `src/lib/quoting-common/` — troligtvis tom, vi skapar strukturen nu
- **Ändrar / skapar:**
  - **Skapar:** `src/lib/quoting-common/domain/types.ts` — rena TypeScript-typer (ingen Drizzle-import): `Customer`, `Product`, `PriceBook`, `PriceBookVersion`, `Quote`, `QuoteLine`, `WorkflowEvent`, `QuoteStatus` (union av enum-värdena), `PriceBookStatus`. Inga klasser, inga metoder — bara `type`/`interface`. Client-säkert.
  - **Skapar:** `src/lib/quoting-common/data/customers.ts` — Drizzle-queries:
    - `listCustomers(orgId): Promise<Customer[]>`
    - `getCustomer(orgId, id): Promise<Customer | null>`
    - `createCustomer(orgId, input): Promise<Customer>`
    - `updateCustomer(orgId, id, patch): Promise<Customer | null>`
    - Alla queries har `organizationId` i WHERE — inga undantag.
  - **Skapar:** `src/lib/quoting-common/data/quotes.ts` — Drizzle-queries:
    - `listQuotes(orgId, opts?: { vertical?, status? }): Promise<Quote[]>`
    - `getQuote(orgId, id): Promise<Quote | null>`
    - `createQuote(orgId, input): Promise<Quote>` — anropar `nextQuoteNumber` (S1-3) internt.
    - `updateQuote(orgId, id, patch): Promise<Quote | null>`
    - `softDeleteQuote(orgId, id): Promise<void>` — sätter status `rejected`.
    - `listQuoteLines(orgId, quoteId): Promise<QuoteLine[]>`
    - `upsertQuoteLines(orgId, quoteId, lines): Promise<QuoteLine[]>`
    - `appendWorkflowEvent(orgId, quoteId, event): Promise<void>`
  - **Skapar:** `src/lib/quoting-common/data/products.ts` — Drizzle-queries:
    - `listProducts(orgId, opts?: { vertical? }): Promise<Product[]>`
    - `getProduct(orgId, id): Promise<Product | null>`
    - `listPriceBooks(orgId): Promise<PriceBook[]>`
    - `getLatestPublishedVersion(orgId, priceBookId): Promise<PriceBookVersion | null>`
- **Rör inte:** `src/lib/db/queries.ts` (mail-lagret), entitlements.ts, schema-filer.
- **AC:**
  - Alla queryfunktioner har `organizationId` i varje WHERE-klausul.
  - `npm run typecheck` passerar.
  - Inga `@/lib/db` direktimporter från vertikaler eller routes (lint passerar redan).
  - Client-säkra typer i `types.ts` (inga server-only imports).
- **Verifiering:** `npm run typecheck && npm run lint`
- **Out-of-scope:** `nextQuoteNumber` (S1-3), API-routes (S1-4), UI (S1-5).

---

## S1-3 · Quote state machine + nummer-sekvensering

- **§-ref:** §6.2 (quoting_quote_number_sequences), §8.1, B4
- **Storlek:** S (~30 min)
- **Läs först:**
  - `src/lib/db/schema.quoting.ts` — `quoting_quote_number_sequences`-tabellen (S1-1)
  - `src/lib/quoting-common/domain/types.ts` — `QuoteStatus` (S1-2)
- **Ändrar / skapar:**
  - **Skapar:** `src/lib/quoting-common/domain/quote-state.ts`:
    - `QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]>` — giltiga statusövergångar (t.ex. `draft → [calculating, ready, rejected]`, `sent → [viewed, expired, rejected]`, `signed → []`).
    - `canTransition(from: QuoteStatus, to: QuoteStatus): boolean`.
    - Exportera som rena funktioner — ingen DB, ingen I/O.
  - **Skapar:** `src/lib/quoting-common/data/quote-number.ts`:
    - `nextQuoteNumber(db, orgId: string): Promise<string>` — atomisk upsert mot `quoting_quote_number_sequences` med `year = currentYear`, incrementar `lastUsed`, returnerar `OFF-${year}-${String(lastUsed).padStart(4, '0')}`. Körs i transaction eller med `ON CONFLICT DO UPDATE ... RETURNING`.
  - **Skapar:** `src/lib/quoting-common/domain/quote-state.test.ts` — 5–8 vitest-tester: giltiga övergångar är tillåtna, ogiltiga blockeras, terminaltillstånd (`signed`, `expired`, `rejected`) accepterar inga vidare transitions.
- **Rör inte:** `createQuote` i `data/quotes.ts` — kopplingen sker i S1-4 (routes). Inga UI-filer.
- **AC:**
  - `canTransition('draft', 'sent')` → `false` (måste gå via `ready`).
  - `canTransition('ready', 'sent')` → `true`.
  - `canTransition('signed', 'draft')` → `false`.
  - `nextQuoteNumber` returnerar `OFF-2026-0001` för första anrop, `OFF-2026-0002` för nästa (inom samma org+år).
  - Vitest-suite grön.
- **Verifiering:** `npm run typecheck && npm run lint && npm test -- quote-state`
- **Out-of-scope:** `createQuote`-integration (S1-4), UI, API.

---

## S1-4 · API-routes: customers + quotes CRUD

- **§-ref:** §8.1, §8.2
- **Storlek:** M (~60 min)
- **Läs först:**
  - `src/app/api/app/inboxes/route.ts` (exakt livscykel-mönster: auth → account → access → product → rbac → zod → service)
  - `src/lib/quoting-common/data/customers.ts` (S1-2)
  - `src/lib/quoting-common/data/quotes.ts` (S1-2)
  - `src/lib/quoting-common/data/quote-number.ts` (S1-3)
  - `src/lib/app/entitlements.ts` — `hasProductAccess`
- **Ändrar / skapar:**
  - **Skapar:** `src/app/api/quoting/customers/route.ts` — `GET` (list) + `POST` (create).
    - Gate: `hasProductAccess(account, vertical)` där `vertical` hämtas från query-param `?vertical=solar` (POST: från body). Saknad eller icke-aktiverad vertikal → 403 `product_required`.
    - POST zod-schema: `{ name: string, orgNumber?, email?, phone?, address?, meta? }`.
    - Delegerar till `listCustomers` / `createCustomer`.
  - **Skapar:** `src/app/api/quoting/quotes/route.ts` — `GET` (list) + `POST` (create).
    - POST zod-schema: `{ vertical: string, customerId?: string, priceBookVersionId?: string, validUntil?: string, meta?: object }`.
    - POST: skapar quote + tilldelar nummer via `nextQuoteNumber` + appendar `WorkflowEvent { toStage: 'draft' }`.
    - GET: stödjer `?vertical=solar&status=draft` filter.
  - **Skapar:** `src/app/api/quoting/quotes/[id]/route.ts` — `GET` (detail med lines + workflow), `PATCH` (update med `canTransition`-validering på statusbyte), `DELETE` (soft-delete → status `rejected`).
  - Alla routes: `export const runtime = "nodejs"`, fullständigt livscykel-mönster.
- **Rör inte:** solar-specifika routes (de är S2+), mail-routes, entitlements.ts.
- **AC:**
  - `POST /api/quoting/quotes` med `vertical: 'solar'` för icke-entitled org → 403.
  - `POST /api/quoting/quotes` med `vertical: 'solar'` för entitled org → 201 + `number: "OFF-2026-0001"`.
  - `PATCH /api/quoting/quotes/[id]` med `{ status: 'sent' }` när befintlig status är `draft` → 422 (ogiltig transition).
  - `PATCH /api/quoting/quotes/[id]` med `{ status: 'ready' }` från `draft` → 200.
  - `npm run typecheck && npm run lint` gröna.
- **Verifiering:** `npm run typecheck && npm run lint && npm run build`
- **Out-of-scope:** `/api/quoting/catalog/*`, `/api/quoting/kb`, `/api/quoting/solar/*` — de landas i S2+.

---

## S1-5 · Solar workspace UI — offerter + kunder

- **§-ref:** §10, §4
- **Storlek:** M (~60 min)
- **Läs först:**
  - `src/app/(portal)/solar/layout.tsx` (befintligt shell från S0-4)
  - `src/app/(portal)/app/inbox/page.tsx` eller liknande listvy (UI-mönster: server component, fetch i page, tabellkomponent)
  - `src/lib/quoting-common/domain/types.ts` (S1-2)
  - `src/components/portal/` — befintliga UI-komponenter att återanvända
- **Ändrar / skapar:**
  - **Skapar:** `src/components/quoting-common/QuoteStatusBadge.tsx` — liten client-komponent som renderar QuoteStatus som en färgad badge (draft=grå, ready=blå, sent=lila, accepted=grön, signed=grön-mörk, rejected/expired=röd). Inga externa beroenden utöver tailwind + `cn()`.
  - **Skapar:** `src/app/(portal)/solar/quotes/page.tsx` — server component:
    - Auth + `hasProductAccess('solar')` guard (redirect om false).
    - Hämtar offerter via `listQuotes(orgId, { vertical: 'solar' })`.
    - Renderar en enkel tabell: nummer, kund, status-badge, totalbelopp, skapad.
    - Tom-state: "Inga offerter ännu — skapa din första nedan." + länk/knapp.
    - Ingen pagination i S1 — kommer S2+.
  - **Skapar:** `src/app/(portal)/solar/customers/page.tsx` — server component:
    - Auth + `hasProductAccess('solar')` guard.
    - Hämtar kunder via `listCustomers(orgId)`.
    - Enkel tabell: namn, org-nr, e-post, skapad.
    - Tom-state.
  - **Ändrar:** `src/app/(portal)/solar/page.tsx` — ersätt S0-placeholder med en minimal dashboard: två summary-cards (antal offerter, antal kunder) + snabblänkar till `/solar/quotes` och `/solar/customers`. Behåll enkelheten.
- **Rör inte:** quoting-common API-routes, solar-motor (S2), construction/trades-sidor, mail-portal.
- **AC:**
  - `/solar/quotes` renderar utan fel för entitled org (tom lista är OK).
  - `/solar/customers` renderar utan fel.
  - `/solar` (dashboard) visar summary-cards.
  - `npm run build` grön (App Router-validering fångar trasiga server components).
  - Visuellt konsekvent med befintlig portal-design (dark theme, primary-färg, rounded-xl-mönster).
- **Verifiering:** `npm run typecheck && npm run lint && npm run build`
- **Out-of-scope:** skapa-formulär för offerter/kunder (S2), filtrering, pagination, ROI-visning.

---

## S1-6 · Verifiering, docs-sync, project-state

- **§-ref:** —
- **Storlek:** S (~20 min)
- **Läs först:**
  - `.claude/context/project-state.md` (mönstret för "Vad som gjorts sedan senast")
  - `docs/architecture/tasks/phase-s1.md` (detta dokument — för att sammanfatta vad som levererades)
- **Ändrar / skapar:**
  - **Ändrar:** `.claude/context/project-state.md` — ny sektion `### Fas S1 — Quoting-common kernel (klar)` med kort sammanfattning: tabeller, data-lager, state machine, API-routes, UI-sidor.
  - Uppdatera roadmap-raden i project-state.md: `Fas S1 ✅`.
- **AC:**
  - `npm run typecheck` ✅
  - `npm run lint` ✅
  - `npm test` ✅ (alla befintliga + S1-3-tester)
  - `npm run build` ✅
  - project-state.md reflekterar nuläget.
- **Verifiering:** `npm run typecheck && npm run lint && npm test && npm run build`
- **Out-of-scope:** S2. När S1-6 är klar är Fas S1 stängd.

---

## Sessionsregler (identiska med S0)

1. **En task per session.** Uppstår en task större än L — pausa och dela den.
2. **Rör inte produktions-DB.** SQL för Neon presenteras som snippet; Sebastian kör.
3. **Inga nya npm-paket** utan motivering i commit-meddelandet.
4. **`organizationId`-scope är heligt.** Varje Drizzle-query utan org-predicate är en bugg.
5. **Avvikelser eskaleras direkt** om arkitekturdokumentet och verkligheten divergerar.

---

## När Fas S1 är klar

Säg `Stäng S1` — Claude uppdaterar project-state, stänger fas, skissar S2-task-packet (`docs/architecture/tasks/phase-s2.md`).
