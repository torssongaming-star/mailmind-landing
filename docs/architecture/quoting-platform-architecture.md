# Quoting Platform & Vertical Modules — Enterprise Architecture & Integration Plan

> **Status:** Architecture & planning only. No implementation.
> **Author role:** Senior SaaS architect / enterprise fullstack engineer.
> **Target host platform:** Mailmind (Next.js 16 App Router · Clerk · Neon Postgres + Drizzle · Stripe · Vercel).
> **First market:** Sweden. **Primary customer profile:** Swedish SMBs that sell quoted work. **Segment:** general SMB.
> **Verticals in scope, 12-month horizon:** Solar, Construction (Bygg/Entreprenad), Trades (El/VVS/Hantverk). **First vertical built end-to-end:** Solar.
> **Last verified against codebase:** 2026-05-27.
> **Renamed 2026-05-28** from `solar-module-architecture.md` to reflect multi-vertical scope.

This document designs a **multi-vertical quoting platform inside Mailmind**: a shared quoting kernel (`lib/quoting-common/`) that owns ~80 % of what every quoting workflow needs (customers, products, price book, quote aggregate, lines, PDF, signing, KB, egress, workflow), and **vertical modules** built on top of it (Solar, Construction, Trades) that own only what is genuinely different — the **calculation engine** and **vertical-specific data shapes**. A Swedish solar-installer (e.g. Bosse Bygg) is the example tenant; the same machinery serves a construction firm or a trades shop with a different vertical mounted.

Every decision is anchored in patterns that *already exist* in Mailmind: where the platform solves a concern (auth, tenancy, billing, RBAC, events, logging), the quoting kernel consumes that capability instead of forking it; verticals consume the quoting kernel instead of duplicating it.

Legend used throughout:

- **PLATFORM CORE** — shared kernel of Mailmind (identity, tenancy, billing, events, …). One per platform.
- **QUOTING-COMMON** — shared quoting library inside the platform (`lib/quoting-common/`). One per platform.
- **VERTICAL** — a quoting product domain (Solar, Construction, Trades). Many per platform, each a `PlatformModule`.
- **CONTRACT** — a stable interface (TS type, event, port, HTTP shape) decoupling layers.

---

## 0. Architectural principles (the rules every later section obeys)

1. **Modular monolith first, microservice-ready later.** Ships in the same Vercel deploy on Neon Postgres. Quoting-common and the verticals are bounded contexts written behind contracts so they can be extracted when justified (§17). Premature extraction is rejected.
2. **Domain-Driven Design with explicit bounded contexts.** Three concentric rings: platform core → quoting-common → vertical. Each layer talks down only to the next ring it depends on, never sideways into a peer's internals.
3. **One way to do every shared thing.** Identity = Clerk. Tenancy = `organizations`. Billing = Stripe sub + `org_product_access`. Customer/quote/PDF/KB = quoting-common. A vertical that needs "another way" must justify it and put the variant *behind a port*, not duplicate the shared code.
4. **Dependency rule (enforced by lint, §3.4):** `vertical → quoting-common → platform core`. Never reversed. Verticals never import each other.
5. **Tenant isolation is non-negotiable and inherited.** Every quoting/vertical read/write scoped by `organizationId` (Mailmind's existing rule). No exceptions (§7).
6. **AI authors, the deterministic engine computes.** AI is the core authoring flow across all verticals; per-vertical deterministic engines own every number. Every AI-built quote is a draft subject to source-grounding + confidence/risk gating + dry-run before send. KB confidentiality is solved structurally (§13).
7. **Auditability and observability are free.** Reuse `auditLogs`, the PII-masking logger, Sentry, PostHog. No quoting action is invisible.

---

## 1. Complete system architecture (overview)

### 1.1 Where quoting and the verticals sit in Mailmind

```
                           ┌──────────────────────────────────────────────────────────────┐
                           │                       Mailmind Platform                       │
                           │                       (single Vercel deploy)                  │
                           │                                                                │
   Clerk (identity)  ────▶ │  PLATFORM CORE  (shared kernel)                                │
   Stripe (billing) ────▶ │   auth · tenancy · entitlements · RBAC · billing · events ·    │
                           │   QStash · notifications · Vercel Blob · audit/logger/Sentry · │
                           │   PostHog · design system · i18n · security middleware         │
                           │                                                                │
                           │  ┌─────────────────────────────────────────────────────────┐  │
                           │  │  QUOTING-COMMON  (lib/quoting-common/) — shared library  │  │
                           │  │  customer · product · price book · quote + lines · PDF · │  │
                           │  │  KB · classification · egress gate · workflow · signing  │  │
                           │  │  AI authoring layer · events bus for quoting              │  │
                           │  └────────────▲────────────────▲────────────────▲────────────┘  │
                           │               │                │                │              │
                           │   ┌───────────┴────┐ ┌─────────┴────────┐ ┌────┴───────────┐ │
                           │   │  SOLAR         │ │  CONSTRUCTION    │ │  TRADES        │ │
                           │   │  (vertical)    │ │  (vertical, S6)  │ │  (vertical,S7) │ │
                           │   │  ROI engine,   │ │  BoQ engine,     │ │  hours+matrl   │ │
                           │   │  roof surfaces,│ │  project sites,  │ │  + RUT engine, │ │
                           │   │  ROT, panels   │ │  RUT for labor,  │ │  jobsites      │ │
                           │   │                │ │  påslag          │ │                │ │
                           │   └────────────────┘ └──────────────────┘ └────────────────┘ │
                           │                                                                │
                           │  ┌─────────────────────────────────────────────────────────┐  │
                           │  │  MAIL MODULE (existing)                                  │  │
                           │  │  inbox, threads, AI support drafts, auto-send            │  │
                           │  └─────────────────────────────────────────────────────────┘  │
                           │            ▲                                                   │
                           │            └─────── platform event bus (QStash) ─────────────┘ │
                           └──────────────────────────────────────────────────────────────┘
                                                  │
        External integrations (per-tenant, behind ports owned by quoting-common where universal,
        or by a vertical where vertical-specific):
        Fortnox · BankID/e-sign (signing) · Satellite/roof imagery (solar) · …
```

### 1.2 Logical layers (top to bottom)

1. **Presentation** — App Router route groups `(portal)/solar`, `(portal)/construction`, `(portal)/trades` mounted per enabled vertical, reusing the shared design system and `components/quoting-common/*` building blocks (QuoteBuilder, QuoteList, PriceBookEditor) plus thin vertical UI panels.
2. **Application / API** — Route handlers at `/api/quoting/*` (universal operations) and `/api/quoting/<vertical>/*` (vertical-specific math), following the exact `auth → account → access → product → RBAC → zod → service` lifecycle proven in `/api/app/**`.
3. **Quoting-common services** — `lib/quoting-common/**`: use-cases and domain (customer, product, quote aggregate, PDF rendering, KB, classification, egress, workflow base, AI authoring layer).
4. **Vertical services** — `lib/<vertical>/**`: a vertical's engine (Solar ROI, Construction BoQ, Trades hours+materials) and vertical-specific extension data (roof surfaces, project sites, jobsites).
5. **Data access** — Drizzle queries scoped by `organizationId`. Quoting-common writes `quoting_*` tables; each vertical writes `<vertical>_*` extension tables. Same Neon Postgres instance.
6. **Platform kernel** — consumed via stable imports from `@/lib/app/*` and `@/lib/db`.
7. **Integration / adapters** — Fortnox, BankID, imagery, e-sign behind ports declared in quoting-common (universal: signing, accounting) or in the relevant vertical (vertical-specific: roof imagery).

### 1.3 Quality attributes targeted

Modularity and low coupling (verticals extractable later), multi-tenant safety, SaaS scale (stateless serverless + Neon HTTP driver), maintainability via DDD + contracts, expandability (a new vertical is ~20 % work versus a new full module), and reproducibility of all customer-facing numbers across price-book and engine version changes.

---

## 2. How quoting integrates into Mailmind

Three plausible "shapes" form an evolution path. We commit to **Shape A**, designed so **B and C are reachable without rewrite.**

### Shape A — Quoting kernel + verticals inside the existing deployment (commit now)

Quoting-common is a library inside `lib/`. Each enabled vertical is a `PlatformModule` registered in `src/config/products.ts`. A tenant with the `solar` product sees the Solar workspace; a tenant with `construction` sees Construction. Same login, same org, same billing portal. One Vercel deploy, one Neon DB.

**Why now:** lowest integration cost, immediate reuse of auth/tenancy/billing/RBAC/events, single deploy, single DB connection budget on Neon. Matches the platform's current operational reality and supports three verticals from one codebase.

### Shape B — Formal workspace/product switcher (near-term UX)

Navigation gains a product switcher; `org_product_access` (§6.4) gates which products are visible. Still one deployment, one DB. This is the natural UX as the second vertical ships.

### Shape C — Extracted services (future, only if justified)

If one vertical or quoting-common needs independent scaling/team autonomy/release cadence, extract the bounded context: its tables move to their own schema or DB, services run as a separate Vercel project, communication over QStash events + a thin internal API. Because boundaries are already enforced by lint and contracts, extraction is a deployment change, not a redesign.

**Integration contract (all shapes).** A vertical imports *only*: `@/lib/quoting-common/*` (its primary substrate), `@/lib/app/*` (kernel helpers), the design system, and the event-publish helper. It must never import another vertical, never reach into the mail module, and never bypass the quoting-common data layer.

---

## 3. Modular, domain-driven architecture

### 3.1 Bounded contexts

| Context | Owner | Responsibility | Talks to others via |
|---|---|---|---|
| **Platform core (shared kernel)** | Platform | identity, tenancy, billing, RBAC, events, notifications, storage, audit | direct imports (it is the kernel) |
| **Mail** (existing) | Mail team | inbox, threads, AI support drafts | events + core |
| **Quoting-common** (new shared) | Platform/Quoting team | universal quoting domain (customer, product, quote, line, PDF, KB, egress, workflow, AI authoring) | events + core; published contracts |
| **Solar** (vertical, first build) | Solar team | ROI engine, roof surfaces, ROT-for-solar | events + quoting-common + core |
| **Construction** (vertical, S6) | Construction team | BoQ engine, project sites, contractor påslag, RUT for labor | events + quoting-common + core |
| **Trades** (vertical, S7) | Trades team | hours + materials + RUT, jobsites | events + quoting-common + core |
| **Integrations** (cross-cutting adapters) | Owner of the consuming context | Fortnox, BankID, imagery | ports/adapters |

### 3.2 Aggregates (consistency boundaries)

Universal aggregates owned by **quoting-common**:

1. **Customer** — the prospect/end-customer being quoted (name, org-nr, contact, address). Shared across verticals within a tenant: a construction firm that also sells solar reuses the same `Customer` record across both quoting flows.
2. **Product** — catalogued items (panel, beam, cable, hour-of-labor, etc.), tagged with the vertical(s) they belong to. Versioning is first-class so historical quotes stay reproducible.
3. **PriceBook & PriceBookVersion** — named, versioned price list. Immutable versions guarantee reproducibility.
4. **Quote** — the aggregate root: line items, totals, VAT/ROT/RUT handling, validity, status, **`vertical` discriminator** identifying which engine + extension data applies.
5. **QuoteLine** — line item belonging to a quote.
6. **WorkflowEvent** — append-only pipeline history.
7. **Document** — generated PDFs and signed artifacts; metadata + Blob pointer.
8. **SigningRequest** — BankID/e-sign state.
9. **KbEntry** — knowledge base entry with audience classification (§13.5).

Vertical-specific extension aggregates owned by **each vertical**:

- **Solar:** `RoofSurface` (per property: area/tilt/azimuth/shading), `RoiScenario` (engine output: kWh/yr, payback, IRR, NPV, CO₂).
- **Construction:** `ProjectSite` (site address, drawings ref, BoQ inputs), `BoqCalculation` (engine output: mängd × á-pris + labor hours + påslag + RUT/ROT split).
- **Trades:** `Jobsite` (visit address, scope), `HoursMaterialsCalculation` (engine output: total hours + materials + RUT-eligible labor portion).

### 3.3 Ubiquitous language (glossary, abbreviated)

`Customer`, `Product`, `PriceBook`, `PriceBookVersion`, `Quote`, `QuoteLine`, `WorkflowEvent`, `Document`, `SigningRequest`, `KbEntry` (universal). `RoofSurface`, `RoiScenario` (Solar). `ProjectSite`, `BoqCalculation` (Construction). `Jobsite`, `HoursMaterialsCalculation` (Trades). These names appear identically in code, DB tables (`quoting_*` / `<vertical>_*`), API paths, and UI copy keys.

### 3.4 Dependency rule (enforced by lint)

```
vertical/presentation → vertical/application → vertical/domain (engine) → vertical/data (extension tables)
              │                                                                    │
              └─────────────▶ quoting-common ◀──────────────────────────────────┘
                                     │
                                     └─────────▶ platform core (shared kernel)
                                     └─────────▶ integration ports

vertical ──✗──▶ another vertical          (forbidden)
core / quoting-common ──✗──▶ vertical     (forbidden)
mail ──✗──▶ quoting / vertical            (forbidden — events only)
vertical/route ──✗──▶ @/lib/db direct     (forbidden — must go via quoting-common data layer)
```

Enforced with `no-restricted-imports` / `eslint-plugin-boundaries` in `eslint.config.mjs`. CI fails on violation.

---

## 4. Scalable folder structure

Extends the existing layout. Everything under `lib/quoting-common/` is shared substrate; each vertical lives in its own sibling folder.

```
src/
├── app/
│   ├── (portal)/
│   │   ├── solar/                       # vertical UI (mounted when product enabled)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── quotes/  customers/  catalog/  settings/
│   │   ├── construction/                # vertical UI (S6)
│   │   └── trades/                      # vertical UI (S7)
│   │
│   └── api/
│       └── quoting/
│           ├── quotes/route.ts          # UNIVERSAL CRUD + list + detail
│           ├── quotes/[id]/route.ts
│           ├── quotes/[id]/pdf/route.ts
│           ├── quotes/[id]/send/route.ts
│           ├── quotes/[id]/sign/route.ts
│           ├── customers/route.ts
│           ├── catalog/products/route.ts
│           ├── catalog/pricebook/route.ts
│           ├── kb/route.ts
│           │
│           ├── solar/                   # VERTICAL endpoints (engine + extension data)
│           │   ├── calculate/route.ts   #   POST → run ROI engine for a quote
│           │   ├── properties/route.ts  #   CRUD roof surfaces
│           ├── construction/            # VERTICAL endpoints (S6)
│           │   ├── calculate/route.ts
│           │   ├── project-sites/route.ts
│           └── trades/                  # VERTICAL endpoints (S7)
│               ├── calculate/route.ts
│               └── jobsites/route.ts
│
├── lib/
│   ├── app/                             # EXISTING platform kernel — DO NOT fork
│   │   ├── entitlements.ts  rbac.ts  audit.ts  notify.ts  …
│   │
│   ├── quoting-common/                  # SHARED quoting library (~80 %)
│   │   ├── domain/
│   │   │   ├── customer/                # entity, invariants
│   │   │   ├── product/  pricebook/     # versioned catalog + price book
│   │   │   ├── quote/                   # aggregate, state machine, totals/VAT/ROT-RUT base
│   │   │   ├── workflow/                # pipeline state machine
│   │   │   ├── kb/                      # entry model + audience classification
│   │   │   └── egress/                  # outbound validation rules
│   │   ├── application/                 # use-cases
│   │   │   ├── createQuote.ts  updateQuote.ts  listQuotes.ts
│   │   │   ├── generateQuotePdf.ts  sendQuote.ts  startSigning.ts
│   │   │   └── runEgressGate.ts
│   │   ├── data/                        # Drizzle queries — ALL organizationId-scoped
│   │   │   └── queries.ts
│   │   ├── pdf/                         # renderer port + universal layout primitives
│   │   ├── kb/                          # retrieval + classification filter
│   │   ├── ai/                          # AI authoring layer (vertical-agnostic; takes engine port)
│   │   ├── events.ts                    # quoting event names + payload types (CONTRACTS)
│   │   ├── ports.ts                     # EngineRef, SigningPort, AccountingPort, ImageryPort
│   │   └── verticals.ts                 # vertical registry + capability descriptors
│   │
│   ├── solar/                           # VERTICAL (first build)
│   │   ├── engine/                      # pure ROI engine (versioned)
│   │   ├── domain/                      # roof surface entity + invariants
│   │   ├── data/                        # solar_* extension tables queries
│   │   ├── pdf/                         # solar template variants (uses common renderer)
│   │   ├── integrations/imagery/        # satellite/roof analysis adapter (future)
│   │   ├── ai-prompts/                  # solar-tuned prompt fragments for the common AI layer
│   │   └── module.ts                    # PlatformModule registration (engine, events, nav)
│   ├── construction/                    # VERTICAL (S6) — same shape as solar/
│   ├── trades/                          # VERTICAL (S7) — same shape as solar/
│   │
│   ├── db/
│   │   ├── schema.ts                    # EXISTING core schema (mail)
│   │   ├── schema.quoting.ts            # quoting_* shared tables
│   │   ├── schema.solar.ts              # solar_* extension tables
│   │   ├── schema.construction.ts       # (S6)
│   │   └── schema.trades.ts             # (S7)
│   │
│   └── plans.quoting.ts                 # quoting plan/add-on config (client-safe)
│
├── components/
│   ├── ui/  design-system/              # EXISTING shared
│   ├── quoting-common/                  # shared quoting UI building blocks
│   │   ├── QuoteBuilder.tsx  QuoteList.tsx  PriceBookEditor.tsx
│   │   ├── KbEntryEditor.tsx  EgressReviewPanel.tsx  WorkflowKanban.tsx
│   ├── solar/                           # solar-only panels (RoofSurfaceEditor, RoiChart…)
│   ├── construction/                    # (S6)
│   └── trades/                          # (S7)
│
└── config/
    └── products.ts                      # product registry (mail, solar, construction, trades)
```

---

## 5. Shared vs isolated services

| Capability | PLATFORM CORE | QUOTING-COMMON | VERTICAL (Solar / Construction / Trades) |
|---|---|---|---|
| Identity / session | ✅ Clerk | — | — |
| Tenancy (`organizations`) | ✅ | — | — |
| Plans & billing | ✅ Stripe | — | — |
| Product enablement | ✅ `org_product_access` | — | — |
| RBAC base roles | ✅ owner/admin/member | quoting capability map | vertical capability extensions |
| Events / queue | ✅ QStash | quoting event taxonomy | vertical events (`quoting.<vertical>.*`) |
| Notifications | ✅ web-push + email | quoting message templates | vertical message variants |
| File storage | ✅ Vercel Blob | document pointers, signed-link helper | — |
| Audit & logging | ✅ `auditLogs` + logger | quoting action names | vertical action names |
| Rate limiting | ✅ Upstash | quoting buckets | vertical engine bucket |
| Design system / i18n | ✅ `components/ui` | `components/quoting-common/*` | vertical components |
| Customer model | — | ✅ universal | — |
| Product / price book | — | ✅ universal (vertical tag on products) | — |
| Quote aggregate + lines | — | ✅ universal (`vertical` discriminator) | — |
| PDF rendering | — | ✅ renderer port + base template | vertical template overlay |
| KB + audience classification | — | ✅ universal | vertical-tagged entries (optional) |
| Egress gate | — | ✅ universal | — |
| Workflow base | — | ✅ universal state machine | vertical state extensions |
| Signing (BankID/e-sign) | — | ✅ port + universal flow | — |
| AI authoring layer | — | ✅ universal (takes engine port + KB) | vertical prompt fragments |
| **Calculation engine** | — | — | ✅ each vertical owns its engine |
| Vertical-specific data (RoofSurface, ProjectSite, Jobsite) | — | — | ✅ vertical |
| Vertical-specific integrations (imagery for solar) | — | — | ✅ vertical |

**Test for "shared vs isolated":** *If two of the three verticals would need it unchanged, it belongs in quoting-common. If it encodes vertical-specific math or vertical-specific data, it belongs in the vertical.*

---

## 6. Database architecture

### 6.1 Strategy: one database, namespaced tables, two prefixes

Single Neon Postgres. Two prefixes:

- `quoting_*` — universal tables, owned by quoting-common.
- `<vertical>_*` — vertical extension tables, owned by that vertical (`solar_*`, `construction_*`, `trades_*`).

Every table follows existing Mailmind conventions: `uuid` PK `defaultRandom()`, `organizationId uuid NOT NULL references organizations(id) on delete cascade`, `createdAt/updatedAt timestamptz default now()`, index on `organizationId`, `pgEnum` for status, `jsonb` (typed via `$type<>()`) for flexible config.

### 6.2 Quoting-common tables (universal)

```
quoting_customers
  id, organizationId(FK), name, orgNumber, email, phone, address jsonb,
  sharedContactId uuid NULL,            -- future platform-level contact link
  meta jsonb, createdAt, updatedAt      idx(organizationId)

quoting_products                         -- catalog item, tenant-scoped
  id, organizationId(FK), kind varchar,  -- 'panel'|'beam'|'cable'|'labor_hour'|… (free-form)
  verticals jsonb $type<string[]>,       -- which verticals this product is for: ['solar'] or ['solar','trades']
  sku, name, spec jsonb, cost numeric NULL,  -- cost is internal_only by data classification (§13.5)
  active bool, createdAt, updatedAt
  idx(organizationId), idx(organizationId, kind)

quoting_price_books
  id, organizationId(FK), name, currency default 'SEK',
  status enum(draft|published|archived), verticals jsonb $type<string[]>,
  createdAt, updatedAt                  idx(organizationId)

quoting_price_book_versions              -- immutable snapshots
  id, organizationId(FK), priceBookId(FK), version int,
  effectiveFrom date, items jsonb,       -- frozen price map + labor rates + VAT/ROT/RUT rules
  publishedAt, createdBy
  uniqueIdx(priceBookId, version)

quoting_quotes                           -- AGGREGATE ROOT — universal
  id, organizationId(FK), customerId(FK→quoting_customers),
  vertical varchar NOT NULL,             -- DISCRIMINATOR: 'solar'|'construction'|'trades'
  number varchar,                         -- per-org human number, e.g. OFF-2026-0042
  status enum(draft|calculating|ready|sent|viewed|accepted|signed|rejected|expired),
  priceBookVersionId(FK),                -- binds quote to a frozen price snapshot
  currency, subtotal, vatAmount, rotDeduction, rutDeduction, total numeric,
  validUntil date, assignedUserId(FK→users NULL),
  meta jsonb,                             -- vertical-extension metadata + AI authoring metadata
  createdBy, createdAt, updatedAt
  idx(organizationId), idx(organizationId, status), idx(organizationId, vertical),
  uniqueIdx(organizationId, number)

quoting_quote_lines
  id, organizationId(FK), quoteId(FK on delete cascade),
  productId(FK NULL), description, qty numeric, unitPrice numeric,
  lineTotal numeric, sortOrder int, meta jsonb           idx(quoteId)

quoting_workflow_events                  -- append-only pipeline history
  id, organizationId(FK), quoteId(FK), fromStage, toStage,
  actorUserId(FK NULL), reason, createdAt
  idx(quoteId), idx(organizationId, createdAt)

quoting_documents                        -- generated artifacts (PDFs etc.)
  id, organizationId(FK), quoteId(FK), kind enum(quote_pdf|signed_pdf|attachment),
  blobUrl text, mimeType, checksum, createdAt           idx(quoteId)

quoting_signing_requests                 -- BankID / e-sign
  id, organizationId(FK), quoteId(FK), provider, providerRef,
  status enum(pending|signed|declined|expired|failed), signerInfo jsonb,
  createdAt, updatedAt                  idx(organizationId), idx(quoteId)

quoting_kb_entries                       -- knowledge base (universal table, vertical-tagged)
  id, organizationId(FK), title, body,
  category enum(faq|policy|spec|caveat|other),
  visibility enum(internal_only|customer_facing) NOT NULL DEFAULT 'internal_only',
  vertical varchar NULL,                 -- 'solar'|'construction'|'trades' or NULL = universal
  embedding vector NULL,                 -- future pgvector retrieval
  source, createdBy, createdAt, updatedAt
  idx(organizationId), idx(organizationId, vertical), idx(organizationId, visibility)

quoting_usage_counters                   -- per-vertical monthly usage
  id, organizationId(FK), month date, vertical varchar,
  quotesCreated int, pdfsGenerated int, engineCalcs int, aiAuthoringRuns int
  uniqueIdx(organizationId, month, vertical)
```

### 6.3 Vertical extension tables (one prefix per vertical)

```
SOLAR (first build)
solar_properties
  id, organizationId(FK), customerId(FK→quoting_customers),
  address jsonb, roofSurfaces jsonb,    -- segments: area, tilt, azimuth, shading
  imagerySource varchar NULL, imageryRef jsonb NULL,  -- future satellite
  createdAt, updatedAt                  idx(organizationId), idx(customerId)

solar_quote_extension                    -- 1:1 extension linked to quoting_quotes
  id, organizationId(FK), quoteId(FK→quoting_quotes UNIQUE), propertyId(FK NULL),
  meta jsonb,                            -- solar-specific quote fields (system size, battery, …)
  createdAt, updatedAt                  uniqueIdx(quoteId)

solar_roi_scenarios                      -- reproducible engine output
  id, organizationId(FK), quoteId(FK), engineVersion varchar,
  inputs jsonb,                          -- frozen inputs (consumption, price, surfaces, …)
  results jsonb,                         -- kWh/yr, self-consumption %, payback, IRR, NPV, CO2
  createdAt                             idx(quoteId)

CONSTRUCTION (S6, sketched)
construction_project_sites    (org, customer, address, drawings ref, scope, …)
construction_quote_extension  (1:1 → quoting_quotes, siteId, contract type, …)
construction_boq_calculations (engineVersion, inputs frozen, results: mängd+labor+påslag+RUT/ROT split)

TRADES (S7, sketched)
trades_jobsites
trades_quote_extension
trades_hours_materials_calculations
```

### 6.4 Multi-product entitlement layer (extends existing `licenseEntitlements`)

```
products                                 -- registry, seeded
  id, key uniqueIdx,                     -- 'mail' | 'solar' | 'construction' | 'trades'
  name, active

org_product_access
  id, organizationId(FK), productKey(FK→products.key),
  status enum(trialing|active|disabled), limits jsonb,
  createdAt, updatedAt                  uniqueIdx(organizationId, productKey)
```

`entitlements.ts` gains `getProductAccess(account, key)` / `hasProductAccess(account, key)` so route gates and UI gates ask one helper. Mail's existing `licenseEntitlements` is preserved unchanged.

### 6.5 Why a `vertical` discriminator on `quoting_quotes` (instead of one quotes table per vertical)

A single quotes table with `vertical varchar` gives:

- One QueryBuilder, one indexer, one search backend across all verticals — a tenant that does both solar and construction lists *all* their quotes in one view if desired.
- Universal operations (PDF, send, sign, workflow) are vertical-agnostic by construction.
- Vertical-specific fields live in the 1:1 extension table (`<vertical>_quote_extension`) — no polymorphic chaos in the main table.
- A future vertical only needs (a) `products` entry, (b) `<vertical>_*` tables, (c) an engine — never a duplicate quotes table.

### 6.6 Reproducibility (unchanged from solar-only draft)

Quotes bind to `priceBookVersionId`; engine outputs store `engineVersion` + frozen `inputs`. Re-opening a 2025 solar quote in 2027 yields identical numbers — defensible legally and for Swedish ROT-/RUT-deduction documentation.

### 6.7 Migrations

Existing drizzle-kit workflow. Heed documented gotchas in `project-state.md`: `ALTER TYPE ADD VALUE` outside transactions; unique indexes at table creation. Each schema file gets its own reviewable changeset.

---

## 7. Tenant isolation strategy

Inherits Mailmind's existing rule for *every* `quoting_*` and `<vertical>_*` table — no exceptions.

1. **Single org identity** — `organizations.id` (uuid). Quoting/verticals add no parallel tenant.
2. **Server-resolved org** — every quoting/vertical route resolves org via `getCurrentAccount(userId)`. Clients never supply org id.
3. **PK + org predicate** — every quoting/vertical query includes `where eq(table.organizationId, account.organization.id)`. No primary-key-only selects, anywhere.
4. **Query-layer guard** — all reads/writes go via `lib/quoting-common/data/*` (universal) or `lib/<vertical>/data/*` (extensions). Routes/components cannot import `db` directly; lint enforces.
5. **Cascade on tenant deletion** — every `quoting_*` and `<vertical>_*` table cascades on `organizations` delete. GDPR org-deletion automatically purges. Solar/Construction/Trades each register Blob/asset cleanup with the existing deletion hook.
6. **Required cross-tenant test** — Vitest asserts that fetching another org's quote id, customer id, KB entry, calc scenario, etc. returns 404/empty.
7. **Future hard isolation** — same path as before: schema/database move is mechanical because the data layer is one folder per layer.

---

## 8. API architecture

### 8.1 Convention (identical to existing `/api/app/**`)

Every quoting/vertical route follows:

```
export const runtime = "nodejs";

1. const { userId } = await auth();
2. const account = await getCurrentAccount(userId);  → 400 if !user/org
3. access gate: if (!account.access.canUseApp) → 403
4. product gate: if (!hasProductAccess(account, '<vertical>')) → 403 'product_required'
5. RBAC: requireOrgAdmin(account) for catalog/pricebook/settings mutations
6. zod parse → 400 with issues
7. delegate to lib/quoting-common/application/* or lib/<vertical>/application/*
8. NextResponse.json(...)
```

A developer who knows mail's API style knows quoting's API style. Zero new conventions.

### 8.2 Resource map (v1)

| Method · Path | Purpose | RBAC | Owner |
|---|---|---|---|
| `GET/POST /api/quoting/quotes` | list / create quote (vertical in body) | member+ | common |
| `GET/PATCH/DELETE /api/quoting/quotes/[id]` | read / edit / soft-delete | member+ | common |
| `POST /api/quoting/quotes/[id]/pdf` | generate PDF (async via QStash) | member+ | common |
| `POST /api/quoting/quotes/[id]/send` | send to end customer (egress + confidence gate) | member+ | common |
| `POST /api/quoting/quotes/[id]/sign` | start BankID/e-sign | member+ | common |
| `GET/POST /api/quoting/customers` | shared CRM | member+ | common |
| `GET/POST/PATCH /api/quoting/catalog/products` | catalog | admin/owner | common |
| `GET/POST /api/quoting/catalog/pricebook` | price book versions | admin/owner | common |
| `GET/POST/PATCH /api/quoting/kb` | KB entries (with classification) | admin/owner | common |
| `POST /api/quoting/solar/calculate` | run ROI engine | member+ | solar |
| `GET/POST /api/quoting/solar/properties` | roof surfaces | member+ | solar |
| `POST /api/quoting/construction/calculate` (S6) | BoQ engine | member+ | construction |
| `GET/POST /api/quoting/construction/project-sites` (S6) | sites | member+ | construction |
| `POST /api/quoting/trades/calculate` (S7) | hours+materials | member+ | trades |
| `POST /api/quoting/webhooks/{fortnox,bankid,esign}` | inbound provider callbacks | signature-verified | common |

### 8.3 API rules

- **Versioning:** path-stable v1; breaking changes → `/api/quoting/v2/**`. Internal contracts (events, ports) are the real compatibility surface.
- **Idempotency:** PDF/send/sign/webhooks accept an idempotency key (Mailmind webhook-idempotency discipline).
- **Validation:** zod at the boundary; domain invariants in `lib/quoting-common/domain` and `lib/<vertical>/engine`.
- **Errors:** `{ error, reason }` shape — shared toast/i18n renders them.
- **Webhooks:** signature/clientState verified (matches SendGrid HMAC / Stripe / Microsoft posture already in platform).

### 8.4 Internal contract (extraction-ready)

Use-cases (`createQuote`, `generateQuotePdf`, `runEgressGate`, `<vertical>.calculate`, …) are plain async functions with typed inputs/outputs. In-process now; same signatures behind internal HTTP/RPC if quoting-common or a vertical is extracted (§17).

---

## 9. Event-driven architecture

### 9.1 Bus = existing QStash + cron `tick`

Mailmind's async backbone is reused (QStash + cron + svix). No new infrastructure.

### 9.2 Event taxonomy

Universal quoting events (published by quoting-common), in `lib/quoting-common/events.ts`:

```
quoting.quote.created         { quoteId, organizationId, vertical, customerId, createdBy }
quoting.quote.sent            { quoteId, organizationId, vertical, channel }
quoting.quote.viewed          { quoteId, organizationId, vertical, at }
quoting.quote.accepted        { quoteId, organizationId, vertical, total }
quoting.quote.signed          { quoteId, organizationId, vertical, provider, signedAt }
quoting.quote.expired         { quoteId, organizationId, vertical }
quoting.pricebook.published   { priceBookId, version, organizationId }
quoting.kb.published          { kbEntryId, organizationId, visibility, vertical }
quoting.document.generated    { documentId, quoteId, organizationId }
quoting.egress.blocked        { quoteId, organizationId, reason }
```

Vertical-specific events (published by each vertical), in `lib/<vertical>/events.ts`:

```
quoting.solar.engine.calculated         { quoteId, organizationId, engineVersion, payback }
quoting.construction.engine.calculated  { quoteId, organizationId, engineVersion, totalHours }   (S6)
quoting.trades.engine.calculated        { quoteId, organizationId, engineVersion, rutAmount }    (S7)
```

### 9.3 Consumers (examples)

- **Notifications:** `quoting.quote.viewed/accepted` → web-push + email to assignee (via `notify.ts`).
- **Analytics:** all events → PostHog (shared funnel: quote → sent → viewed → accepted → signed, sliceable by vertical).
- **Audit:** every event → `auditLogs`.
- **Fortnox (future):** `quoting.quote.accepted` → enqueue invoice creation.
- **Cross-product:** mail module *can* subscribe to `quoting.quote.viewed` (e.g. "your prospect just opened the quote") — never queries quoting tables directly.

### 9.4 Delivery semantics

At-least-once with idempotent handlers (keyed on `quoteId` + event type). Heavy work (PDF render, Fortnox push, imagery fetch) always enqueued to QStash — never inline.

---

## 10. Frontend architecture

1. **Route groups per vertical** under `(portal)`. Each inherits the authenticated shell. Solar mounts first; construction and trades mount when their products ship.
2. **Server Components by default**; client islands where interactivity is needed (quote builder, ROI sliders, BoQ table, RUT split editor, KB classification toggle).
3. **Workspace switcher** reads `account.products` server-side and renders only enabled verticals (matches §6.4).
4. **Component reuse:** `components/quoting-common/*` provides QuoteBuilder shell, QuoteList, PriceBookEditor, KbEntryEditor, EgressReviewPanel, WorkflowKanban. Verticals provide thin panels (RoofSurfaceEditor, ProjectSiteEditor, JobsiteEditor, RoiChart via `recharts`).
5. **i18n:** Swedish-first, reuses `lib/i18n` sv/en. ROT/RUT/VAT/currency in sv-SE.
6. **State & data:** server-driven; client mutations call quoting APIs; errors flow through shared toast.
7. **Performance:** engine recalc debounced client-side, authoritative server-side. PDF server-side, queued, linked from Blob with signed short-lived URLs.
8. **A11y & polish:** reuse existing skeleton-loader and global error boundary.

---

## 11. Backend architecture

1. **Three internal layers** inside `lib/quoting-common` and each `lib/<vertical>`: `application` (use-cases, orchestration, transaction boundaries) → `domain` (pure business rules, no I/O) → `data` (Drizzle, org-scoped). Routes are thin; they validate and delegate.
2. **Runtime:** `runtime = "nodejs"` (PDF, crypto, integrations need Node APIs).
3. **Transactions:** quote + lines + initial workflow event written atomically; engine output written in a follow-up transaction or as a job's final commit.
4. **Stateless + serverless-friendly** — no in-memory session state; everything from Clerk + DB.
5. **Heavy work off the request path** — PDF, engine batches, imagery, Fortnox/BankID via QStash jobs under `api/jobs/quoting/*`. Mirrors `api/jobs/triage`.
6. **Rate limiting:** Upstash buckets for `calculate` (per vertical), `pdf`, `send` per org/user.
7. **Configuration & secrets:** env vars for global keys; per-tenant integration creds AES-256-GCM encrypted in jsonb (Gmail/Outlook pattern). Never logged, never in client bundles.

---

## 12. PDF generation architecture

### 12.1 Requirements

Branded Swedish multi-page quote PDF: cover, customer + site, system/scope, line items with VAT + ROT/RUT, calculation summary (ROI for solar, BoQ + labor for construction, hours+materials for trades), terms, signature block. Reproducible (bound to price-book version + engine scenario). Archived.

### 12.2 Design

- **Server-side, asynchronous.** Triggered by `POST /api/quoting/quotes/[id]/pdf`. Enqueues to QStash → returns `202 + jobId`; job renders, stores to Vercel Blob, writes `quoting_documents`, emits `quoting.document.generated`.
- **Universal renderer + vertical template overlay.** `lib/quoting-common/pdf` owns the renderer port and the base layout (header, customer block, lines, totals, terms, signature). Each vertical contributes a template overlay (Solar: roof + ROI section; Construction: BoQ + labor breakdown; Trades: hours + RUT split). One renderer, three overlays.
- **Data binding:** job loads frozen `priceBookVersion` + the vertical's engine scenario — never live prices.
- **Storage & access:** Blob URL stored in `quoting_documents`; downloads via org-scoped signed short-lived links.
- **Renderer choice deferred** — see ADR 0001 B6.

---

## 13. Calculation engines (per vertical) + AI authoring layer (universal)

### 13.1 Universal principles (apply to every vertical's engine)

- **Pure, deterministic, versioned.** Engines live in `lib/<vertical>/engine` as pure functions. No DB, no clock, no randomness in the formulas → trivially Vitest-testable (style matches `entitlements.test.ts`).
- **EngineVersion pinning.** Each calculation records `engineVersion` (`solar-roi@1.3.0`, `construction-boq@0.2.0`, `trades-hm@0.1.0`). Bumping the version preserves old quotes exactly because inputs are frozen.
- **Frozen inputs.** Engine inputs stored on the scenario row in the vertical's `_calculations`/`_scenarios` table.
- **Assumptions as data.** Regional irradiation, electricity prices, labor cost benchmarks, RUT/ROT rules in versioned config/data so they update without code change and stay reproducible.

### 13.2 Per-vertical engines (sketched; full design happens in each vertical's phase)

**Solar engine — ROI** (built first):

```
inputs ──▶ production model (kWh/yr per surface; irradiation × tilt/azimuth × shading × degradation)
       ──▶ self-consumption split (load profile vs production)
       ──▶ economics (savings + export revenue − O&M; CapEx after ROT; payback, NPV, IRR)
       ──▶ environmental (CO₂ avoided)
```

**Construction engine — BoQ + labor + påslag** (S6):

```
inputs (BoQ items, labor categories, contract type) ──▶ material cost (qty × á-pris from frozen pricebook)
                                                    ──▶ labor cost (hours × rate per category)
                                                    ──▶ påslag % per category
                                                    ──▶ RUT-eligible labor split (rules)
                                                    ──▶ VAT + ROT/RUT-adjusted totals
```

**Trades engine — hours + materials + RUT** (S7):

```
inputs (job scope, hour estimates, material list) ──▶ labor + material totals
                                                  ──▶ RUT-eligible split (per work type)
                                                  ──▶ VAT-adjusted totals
```

### 13.3 AI authoring layer — universal, vertical-aware (committed model — Alternative B)

The product's central value is that the AI **builds the quote** for the salesperson, grounded in the tenant's knowledge base. This lives in `lib/quoting-common/ai` and is **vertical-agnostic** — it takes the vertical's `EnginePort` and `KbRetriever` as dependencies. Verticals contribute only `ai-prompts/` fragments (vocabulary, examples) — never their own AI authoring code.

```
        Salesperson intent / minimal inputs (customer, scope, vertical = 'solar'|'construction'|'trades')
                                  │
                                  ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │  AI AUTHORING LAYER (quoting-common)                                 │
   │   • retrieves KB entries (customer_facing only; filter on vertical)  │
   │   • uses vertical's prompt fragments + examples                      │
   │   • proposes line items, narrative text, structured engine inputs    │
   └───────────────────────────────────────────────────────────────────┘
                                  │  (structured inputs, not free-text numbers)
                                  ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │  VERTICAL DETERMINISTIC ENGINE  (solar | construction | trades)      │
   │   • resolves prices from the frozen price-book version               │
   │   • computes totals, VAT, ROT/RUT, vertical-specific math            │
   └───────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
            Draft quote ──▶ source-grounding + confidence/risk gate ──▶ egress gate ──▶ dry-run ──▶ send
```

Numbers customers can hold you to (price, payback, RUT) come from the engine + frozen price-book version — never from token prediction. The AI's job is the *hard, valuable* part: turning a sparse brief + KB into a complete, well-worded proposal in the right vertical's language.

### 13.4 Knowledge base architecture & data classification

The KB is what the AI grounds quotes in. The critical requirement: **a tenant's KB may hold information that must NOT reach the end customer** — internal costs, supplier terms, margin rules, installation caveats, internal pricing logic. Solved structurally — never "instruct the model to keep a secret."

**Two axes of protection:**

1. **Tenancy (already solved by Mailmind).** `quoting_kb_entries` is `organizationId`-scoped. Bosse Bygg's KB is invisible to other tenants.
2. **Audience classification (the new axis, within a tenant).** Every entry carries a `visibility`:
   - `internal_only` — usable for *reasoning and calculation*, never emitted to the customer.
   - `customer_facing` — approved for outbound quote/PDF/email.

Default is `internal_only` (fail-safe). Promotion to `customer_facing` is an owner/admin action, audit-logged.

Entries are optionally tagged with `vertical` so AI grounding can filter to relevant entries (a solar quote retrieves `vertical='solar' OR vertical IS NULL` entries).

**Grounding rules:**

- **Customer-facing generation** retrieves **only `customer_facing`** entries. Same rule the mail AI follows (`source_grounded: true`).
- **Internal reasoning** *may* consult `internal_only`, but those values flow into the engine as inputs, not into generated text. Cost informs price; cost is never written down.
- **Context minimization (anti-exfiltration).** Internal figures go to the engine, not the LLM prompt. Anything `internal_only` reaching the model is redacted/abstracted (model sees "apply standard margin band B", not the invoice).

### 13.5 Egress / outbound content control (defense in depth)

Before any quote leaves the tenant (PDF render, email, signing), the artifact passes outbound validation:

1. **Source attribution** — every customer-facing claim traces to a `customer_facing` KB entry, the price book, or engine output. Unattributed content is flagged.
2. **Internal-data scan** — rendered content checked against the tenant's `internal_only` markers; hit blocks send and routes to human review.
3. **Confidence + risk + dry-run** — locked decision: auto-send only at confidence ≥ 90 %, source-grounded, low risk, no blockers, with dry-run before auto-send is enabled.
4. **Audit** — pass/block recorded (`action: "quoting.quote.egress_blocked"` / `"…sent"`).

Net effect across the four layers (tenant scope → audience classification → context minimization → egress gate): internal information leaking to the end customer is a **structurally prevented** event, not a matter of trusting the model.

---

## 14. Security architecture

Inherits platform hardening (HMAC webhooks, CSP/HSTS/XFO, rate limits, prompt-injection defenses, const-time cron auth, open-redirect fixes, PII-masking logger, Sentry).

1. **AuthN/Z:** Clerk session on every route; org + RBAC + product-access checks server-side.
2. **Tenant isolation:** §7.
3. **Input validation:** zod everywhere; domain invariants in common + vertical.
4. **Secrets:** env vars; per-tenant integration tokens AES-256-GCM in jsonb. Never logged.
5. **Webhook authenticity:** signature verification mandatory (Fortnox/BankID/e-sign + existing Stripe/SendGrid/Microsoft).
6. **BankID & e-sign (high assurance):** signing flows server-side; signer + audit trail in `quoting_signing_requests`; signed PDF checksum recorded.
7. **PII & GDPR:** quoting customers + sites are personal data → covered by existing export + 30-day deletion + cron purge. Each vertical registers Blob/asset cleanup.
8. **AI safety & KB confidentiality:** §13.3–13.5 + source-grounding + prompt-injection defenses + audience classification + egress gate + confidence/risk gating + dry-run.
9. **Rate limiting & abuse:** expensive endpoints (engine, PDF, imagery) limited per org/user; integration calls circuit-broken.
10. **Auditability:** every mutation, integration call, signing event, price-book change → `auditLogs`.

---

## 15. PlatformModule contract & vertical registration

A vertical declares:

```ts
interface PlatformVertical {
  key: 'solar' | 'construction' | 'trades' | string;
  displayName: string;

  // CALCULATION ENGINE (the heart of the vertical)
  engine: {
    version: string;                          // e.g. 'solar-roi@1.3.0'
    run(inputs: unknown, ctx: EngineCtx): EngineResult;
    inputSchema: ZodSchema;                   // validated at the boundary
    resultSchema: ZodSchema;
  };

  // EXTENSION DATA
  extensionSchema: DrizzleSchemaFragment;     // <vertical>_* tables
  extensionQueries: VerticalDataLayer;        // org-scoped data access

  // UI
  nav: NavEntry;                              // workspace switcher entry, icon, gating
  uiPanels: {
    quoteBuilder?: ComponentRef;              // vertical extension panel
    sitesEditor?: ComponentRef;
    calculationView?: ComponentRef;
  };

  // AI
  aiPromptFragments: AiPromptPack;            // vocabulary + examples (no AI code)

  // PDF
  pdfTemplateOverlay: PdfOverlay;

  // EVENTS
  events: { publishes: string[]; subscribes: string[] };

  // OPS
  jobs?: JobHandlerSpec[];                    // QStash handlers
  lifecycleHooks?: { onProductEnabled; onProductDisabled; onOrgDeleted };
}
```

Verticals are listed in `src/config/products.ts`; the platform reads the registry to build navigation, gate access, register event subscriptions, mount routes, and run lifecycle hooks. **The platform core and quoting-common never import a vertical;** verticals self-register via the module contract.

---

## 16. Deployment strategy

1. **Now (Shape A):** quoting-common + solar ship in the same Vercel project. Same CI (lint + `tsc --noEmit` + Vitest), same preview deploys, same env management.
2. **Feature flags:** every vertical is gated by `org_product_access` + a flag (env or PostHog), so verticals ship dark per-tenant. Pilot first → expand. Matches the demo-led GTM (locked decision).
3. **CI gates:** import-boundary lint, cross-tenant isolation test, engine + KB + egress unit tests are required.
4. **Observability:** Sentry + PostHog from day one; quoting funnels per vertical (created → sent → viewed → accepted → signed).
5. **Migrations & rollback:** additive — new `quoting_*`, `<vertical>_*`, `products`, `org_product_access`. No change to existing mail tables. Reversible via flag disable.
6. **Data/keys ops:** new env vars (Fortnox, BankID, imagery, PDF renderer) in Vercel; per-tenant creds encrypted at rest.

---

## 17. Future microservice compatibility

Monolith now, extraction-ready by construction. Cut lines are already clean:

1. **Bounded contexts + contracts.** Quoting-common and each vertical touch the rest only via stable imports + typed events. Nothing in the platform core or mail imports quoting/verticals. Nothing in one vertical imports another.
2. **Data extraction path.** `quoting_*` and `<vertical>_*` prefixes + dedicated schema files → step 1 move to a Postgres schema, step 2 dedicated DB, step 3 own service. Only `lib/quoting-common/data` and the vertical's data folder change connection target.
3. **Service extraction path.** Use-cases (`createQuote`, `runEgressGate`, `<vertical>.engine.run`, …) have HTTP-friendly signatures. Wrap them in a separate Vercel project; replace in-process calls with internal API calls behind the same function names. Events already flow over QStash cross-service unchanged.
4. **Identity across services.** Clerk JWT verifies anywhere; extracted services re-derive org without shared session store.
5. **What stays shared even after extraction:** identity (Clerk), tenancy registry (`organizations`), billing (Stripe), event bus (QStash), notifications, analytics, design system.
6. **When to extract:** independent scaling/team autonomy/release-cadence divergence/regulatory hard-isolation — not before.

---

## 18. What MUST be shared with Mailmind

Owned by the platform core; quoting-common and verticals consume — never fork or duplicate:

- Identity & authentication (Clerk).
- Tenancy (`organizations`, `organizationId`).
- Billing & subscription (Stripe customer + sub per org; product enablement layered).
- Base RBAC roles (owner/admin/member).
- Entitlement decision point (`entitlements.ts` with `hasProductAccess`).
- Event bus & job queue (QStash + cron `tick`).
- Notification infrastructure (web-push + email via `notify.ts`).
- File storage (Vercel Blob).
- Audit, logging, monitoring (`auditLogs`, PII-masking logger, Sentry).
- Analytics (PostHog).
- Design system & i18n (`components/ui`, design-system, sv/en).
- Security middleware (Clerk middleware, security headers, rate limiter).
- GDPR machinery (export + deletion + cron purge).

Also shared but at the **quoting-common** layer (one level inside the core), consumed by every vertical:

- Customer, product, price book, quote aggregate, lines, workflow base, signing flow, PDF renderer (universal), KB tables + classification, egress gate, AI authoring layer, signed-link helper, quoting event taxonomy.

## 19. What MUST remain isolated (vertical-owned)

- Vertical **calculation engine** (Solar ROI, Construction BoQ, Trades hours+materials).
- Vertical **extension data** — `<vertical>_*` tables (RoofSurfaces / ProjectSites / Jobsites, scenarios, quote-extensions).
- Vertical **prompt fragments** — vocabulary, examples (input to the universal AI layer, never AI code itself).
- Vertical **PDF template overlay** — branding and the section that renders the vertical's calculation summary.
- Vertical **integrations** that are vertical-specific (Solar imagery; Construction drawings/CAD links, when relevant).
- Vertical **UI panels** — `components/<vertical>/*` (RoofSurfaceEditor, BoQEditor, JobsiteEditor, calculation views).

**Test for "shared vs isolated":** *If two of the three verticals would need it unchanged, it belongs in quoting-common. If it encodes vertical-specific math or data, it belongs in the vertical.*

---

## 20. How to add a new vertical later

Adding a fourth vertical (e.g. roofing, painting) becomes a small, repeatable task because all the substrate exists:

1. **Register** in `src/config/products.ts` and seed a `products` row.
2. **Schema fragment** — create `src/lib/db/schema.<vertical>.ts` with `<vertical>_*` extension tables and an `_quote_extension` 1:1 table. Reviewed migration.
3. **Engine** — implement `lib/<vertical>/engine` as a pure, versioned function with `inputSchema` and `resultSchema` (Zod).
4. **Prompt fragments** — add `lib/<vertical>/ai-prompts/` so the universal AI authoring layer speaks the vertical's language.
5. **PDF overlay** — add `lib/<vertical>/pdf/` with the vertical's calculation section.
6. **UI panels** — add `components/<vertical>/*` and a route group `(portal)/<vertical>`.
7. **Module manifest** — `lib/<vertical>/module.ts` implementing `PlatformVertical`.
8. **Gate** via `org_product_access`; ship dark behind a flag; enable per-tenant for pilots.
9. **CI** picks up the import-boundary rule and the cross-tenant isolation test automatically (template tests parameterized over verticals).

Result: each new vertical is **additive** — engine + extension data + prompts + overlay + panels. Estimated cost: ~20 % of what a full new module would cost.

---

## 21. Phasing, open decisions & risks

### Suggested delivery phases (planning only — no code yet)

> **Reflects:** committed model "AI as core" (alt. B) and the three-vertical plan. Quoting-common kernel is built before Solar specifics so the substrate the AI builds on is trustworthy; the AI authoring layer follows immediately because it is the product's core value.

```
Phase S0  Foundations                products + org_product_access + entitlement extension,
                                      route group shells (vertical-agnostic mount points),
                                      import-boundary lint rule incl. quoting-common,
                                      nav switcher (dark), products registry config.
Phase S1  Quoting-common kernel      quoting_customers, quoting_products, quoting_price_books +
                                      versions, quoting_quotes + lines (with vertical discriminator),
                                      workflow base + state machine, list/detail UI primitives.
Phase S2  KB + classification + Solar quoting_kb_entries (visibility, vertical), Solar engine
          engine substrate            (deterministic ROI, versioned), solar_properties +
                                      solar_quote_extension + solar_roi_scenarios, SE VAT/ROT rules,
                                      universal egress-gate skeleton.
Phase S3  AI authoring (universal)   lib/quoting-common/ai layer grounding in customer_facing KB,
                                      Solar prompt fragments, AI proposes inputs → Solar engine
                                      computes → draft + confidence/risk gate.
Phase S4  PDF + egress + send        async PDF jobs → Blob → quoting_documents, branded base layout
                                      + Solar overlay, egress gate fully productionized,
                                      send-to-customer + events. Solar send path closes here.
Phase S5  Integrations (universal)   Fortnox (accounting) + BankID/e-sign (signing) behind ports.
Phase S6  Construction vertical      construction_* tables + BoQ engine + prompt fragments +
                                      PDF overlay + UI panels. Validates the vertical-extension model.
Phase S7  Trades vertical            trades_* tables + hours/materials + RUT engine + prompt
                                      fragments + PDF overlay + UI panels.
Phase S8  Imagery + scale + extract  satellite/roof imagery (Solar), shared analytics dashboards;
                                      extraction to dedicated schema/service if justified.
```

### Open decisions (need a call before implementation — see `docs/architecture/decisions/0001-blocking-decisions.md`)

Blocking S0:

1. **B1 — Customer model location.** *Updated framing:* since the customer is now universal, `Customer` lives in **quoting-common** (`quoting_customers`), reused across all verticals within a tenant. The legacy "solar-owned customer with optional shared link" option is no longer relevant — the multi-vertical commit makes the universal model the right default.
2. **B2 — Billing model:** single Stripe subscription with each enabled vertical as an add-on price (recommended).
3. **B3 — KB classification granularity:** entry-level visibility (recommended); cost/margin held as structured engine inputs, not KB prose.

Blocking later phases:

4. **B4** — Quote numbering scheme (blocks S1).
5. **B5** — ROI data sources for Solar (blocks S2).
6. **B6** — PDF renderer library (blocks S4).
7. **B7** — Egress enforcement strictness (blocks S4).

Net-new with the multi-vertical commit:

8. **B8 — Calculation engine boundaries for Construction (S6) and Trades (S7).** What exactly does the BoQ engine compute vs. leave to the salesperson? Defer detailed call to the start of S6/S7, but capture early assumptions in ADR 0002 (later).
9. **B9 — Shared products vs. per-vertical product catalogs?** Recommend a single `quoting_products` table with a `verticals` tag (current §6.2). Confirm before S1.

### Key risks & mitigations

- **Cross-tenant leakage** → query-layer guard + PK-and-org predicates + required isolation test (§7).
- **Cross-vertical leakage** (e.g. solar code reaching into construction data) → import-boundary lint + `vertical` column predicates + required test parameterized over verticals.
- **Internal KB data leaking to end customer** → audience classification + customer-facing-only grounding + context minimization + egress gate (§13.4–13.5).
- **Premature generalization in quoting-common** → only add to common when a second vertical actually needs it; mark new common abstractions with "promoted from vertical X" and require a second use-case before they become canonical.
- **Serverless timeouts on engine/PDF** → everything heavy queued via QStash (§9, §12).
- **Non-reproducible quotes** → price-book versioning + frozen engine inputs + engine version pinning (§6.6, §13.1).
- **Scope drift toward "one giant universal quoting product"** → verticals own their engines and extension data; common only owns the universal aggregate. The dependency rule + lint enforce.

---

### One-paragraph summary

Build the quoting capability as a **two-layer system inside the Mailmind modular monolith**: a shared **quoting-common** library (`lib/quoting-common/`) that owns the universal ~80 % (customer, product, price book, quote aggregate + lines with a `vertical` discriminator, PDF base renderer, KB with audience classification, egress gate, workflow base, signing flow, and the **universal AI authoring layer**), and **vertical modules** (Solar first, then Construction and Trades) that own only the genuinely different ~20 % — their **deterministic calculation engine**, their **extension data** (RoofSurface / ProjectSite / Jobsite, scenarios, quote-extension), their **prompt fragments**, their **PDF template overlay**, and their **UI panels**. Both layers consume Mailmind's platform core (Clerk identity, `organizations` tenant, Stripe billing, base RBAC, QStash event/queue, Vercel Blob, audit/logger/Sentry/PostHog, design system + i18n, GDPR machinery). The **core product flow is AI-built quotes**: the AI authors the proposal grounded in the tenant's `customer_facing` KB while the vertical's deterministic engine produces every number from a frozen price-book version, and every quote is a draft that must clear source-grounding + confidence/risk gating + egress validation + dry-run before it can be sent. Knowledge-base confidentiality is solved structurally in four layers (tenant scope → audience classification → context minimization → egress gate), making "internal info leaking to the end customer" a structurally prevented event. A `products` / `org_product_access` layer plus a `PlatformVertical` contract make adding new verticals additive (~20 % of a full module), while a strict one-way dependency rule (`vertical → quoting-common → core`, never reversed; verticals never import each other) and an org-scoped data-access guard keep every vertical pluggable, tenant-safe, cross-vertical-safe, and extractable into its own service the day that's justified — with no rewrite.
