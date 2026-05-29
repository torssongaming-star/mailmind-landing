# ADR 0002 — Fas S0: Quoting-plattformens fundament

> **Status:** Decided 2026-05-29
> **Skapat:** 2026-05-29
> **Refererar:** `docs/architecture/tasks/phase-s0.md`, `docs/architecture/decisions/0001-blocking-decisions.md`

---

## Kontext

Fas S0 lägger den vertikalagnostiska grunden för Mailminds quoting-plattform. Alla S0-tasks (S0-1 → S0-7) är levererade och verifierade. Detta dokument loggar vad som faktiskt landade och eventuella avvikelser från ursprungsspecen.

---

## Vad S0 levererade

### Databas (S0-1)
- `src/lib/db/schema.quoting.ts` — tre tabeller:
  - **`products`** — plattformens produktregistry (mail, solar, construction, trades). Seedad via `drizzle/seed-products.sql`.
  - **`org_product_access`** — per-tenant-entitlements med `status enum (trialing|active|disabled)` och `limits jsonb`. Unique index på `(organizationId, productKey)`.
  - **`quoting_usage_counters`** — vertikal-agnostisk usage-tabell per `(organizationId, month, vertical)`. Förbereder S1-kvothantering.
- Alla tabeller org-scopade, cascade deletes, konventionsenliga index.

### Entitlement-helper (S0-2)
- `AccountSnapshot.products` — Record med `{ status, limits }` per produkt, populerad parallellt i `getPortalData`.
- `hasProductAccess(account, key)` — `true` för `active`/`trialing`, `false` annars (inkl. saknad rad).
- 6 vitest-tester i `src/lib/app/entitlements.products.test.ts` — alla gröna.

### Produktregister (S0-3)
- `src/config/products.ts` med `PRODUCTS as const satisfies Record<string, PlatformVertical>`.
- `construction` och `trades` markerade `placeholder: true` — syns inte i UI förrän respektive vertikal är byggd.
- Client-säkert (inga server-only imports).

### Solar route-skelett (S0-4)
- `src/app/(portal)/solar/layout.tsx` — auth → account → `hasProductAccess`-gate → redirect `/app` om icke-entitled.
- `src/app/(portal)/solar/page.tsx` — placeholder-dashboard.

### Import-boundary lint (S0-5)
- `eslint.config.mjs` utvidgad med fyra `no-restricted-imports`-block (ESLint 9 flat config):
  1. Plattformskärna → block: vertikaler + quoting-common.
  2. Quoting-common → block: alla vertikaler.
  3. Varje vertikal → block: sina syskonvertikaler + direkt `@/lib/db`.
  4. API-quoting routes → block: direkt `@/lib/db`.
- Regeln verifierades med en medveten testöverträdelse som triggade fel.

### Nav-switcher (S0-6)
- `src/components/portal/ProductSwitcher.tsx` — async React server component.
  - Filtrerar `PRODUCTS` på `!placeholder && hasProductAccess`.
  - Renderar ingenting om < 2 entries (enprodukt-orgar ser ingen switcher).
- Portal-layouten monterar switchern bakom `QUOTING_NAV_ENABLED=1` (env-flagga).
- `Sidebar` tar `productSwitcher?: React.ReactNode` som slot-prop.

---

## Avvikelser från spec

| Task | Avvikelse |
|------|-----------|
| S0-6 | Switcher-ikoner (Mail, Sun från lucide-react) inkluderades trots att spec sa "ikoner = out-of-scope" — förbättrade UX utan extra paket, inga risker. |
| Bonus | `/loi/verified` (välkomstsida efter e-postbekräftelse) levererades utanför S0-scope som del av en separat förbättring av pre-launch-flödet. |

---

## Verifiering (2026-05-29)

```
npm run typecheck  → ✅ 0 fel
npm run lint       → ✅ 0 varningar
npm test           → ✅ 114/114 tester gröna (11 filer)
npm run build      → ✅ Kompilerar rent, /solar och /loi/verified i route-tabellen
```

---

## Nästa steg

Fas S1 kan starta. S1 levererar:
- `quoting_customers` i quoting-common (B1).
- Offert-aggregat med `OFF-YYYY-NNNN`-numrering (B4).
- Solar-specifik motor (PVGIS ROI-kalkyl, B5).
- KB-integration för solar (entry-nivå, B3).

Se `docs/architecture/tasks/phase-s1.md` (skapas vid S1-kickoff).
