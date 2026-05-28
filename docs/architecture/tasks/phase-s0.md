# Fas S0 — Foundations · task-pack

> **För:** Sebastian + Claude (Cowork). Varje task är skriven så att Claude kan komma in i en **fräsch session utan minne av tidigare arbete** och utföra uppgiften självständigt.
> **Refererar:** `docs/architecture/quoting-platform-architecture.md` (Quoting Platform & Vertical Modules) §0, §3.4, §4, §6.4, §8.1, §10, §15.
> **Förutsättning:** Beslut B1, B2, B3, B9 i `docs/architecture/decisions/0001-blocking-decisions.md` är `Decided`.
>
> **2026-05-28:** S0 är *vertikalagnostisk* — den lägger fundamentet för **quoting-plattformen och samtliga vertikaler** (Solar, Construction, Trades). Solar mountas som första vertikal i S0-4 eftersom den är den första vi bygger på riktigt; routes för construction/trades läggs till när respektive vertikal startar (S6/S7). Inget i S0 rör mejl-tabeller eller mejl-flöden.

---

## Hur du (Sebastian) använder detta dokument

För varje session med mig:

1. Välj **en** task nedan (S0-1 → S0-7 i ordning är optimalt — de är beroende).
2. Klistra in i chatten: `Kör S0-X enligt docs/architecture/tasks/phase-s0.md`.
3. Jag läser den task-specen + det den pekar på, gör arbetet, kör verifieringen, presenterar diffen.
4. Du granskar → mergar eller ber om justering.
5. När tasken är klar uppdaterar jag `project-state.md` enligt rutinen.

Avbryt aldrig en task halvvägs och börja en ny i samma session — det förstör kontextfönstret. En task per session är regeln.

---

## Tasks-format (gäller alla S0-X nedan)

Varje task har:

- **§-ref** — vilka avsnitt i arkitekturdokumentet den implementerar.
- **Storlek** — `S` (~30 min), `M` (~60 min), `L` (~90 min). Allt över L är felskuret och ska brytas ner.
- **Läs först** — exakta filer/avsnitt jag måste läsa innan jag rör koden. Detta är kritiskt för cold-start.
- **Ändrar / skapar** — exakta sökvägar.
- **Rör inte** — explicit lista över filer/områden som ligger utanför scope.
- **Acceptanskriterier (AC)** — det objektiva färdig-tillståndet.
- **Verifiering** — kommandona som ska köras grönt innan jag säger "klar".
- **Out-of-scope** — vad som *inte* ingår, även om det är frestande.

---

## S0-1 · DB-foundations: `products`, `org_product_access`, `quoting_usage_counters`

- **§-ref:** §6.4
- **Storlek:** M
- **Läs först:**
  - `CLAUDE.md` (låsta beslut, arbetssätt)
  - `.claude/context/project-state.md` (DB-gotchas, särskilt enum + index på populerade tabeller)
  - `src/lib/db/schema.ts` rad 1–280 (konventioner: pgEnum, uuid PK, organizationId FK, index)
  - `src/lib/db/index.ts` (Neon HTTP-drivern, `isDbConnected`)
- **Ändrar / skapar:**
  - **Skapar:** `src/lib/db/schema.quoting.ts` (ny fil — quoting-plattformens tabeller i egen fil per §4; här bor `products`, `org_product_access`, `quoting_usage_counters` initialt — fler quoting-tabeller landar i S1)
  - **Ändrar:** `src/lib/db/schema.ts` — re-exportera från `schema.quoting.ts` så Drizzle ser allt i samma schema-objekt
- **Innehåll:**
  - `products` (id, key unique, name, active, createdAt) — seedas i S0-3 (separat task).
  - `org_product_access` (id, organizationId FK→organizations cascade, productKey, status enum `trialing|active|disabled`, limits jsonb, createdAt, updatedAt; uniqueIdx(organizationId, productKey))
  - `quoting_usage_counters` (id, organizationId FK cascade, month date, vertical varchar, quotesCreated int, pdfsGenerated int, engineCalcs int, aiAuthoringRuns int; uniqueIdx(organizationId, month, vertical)) — *vertikal-agnostisk tabell, en rad per vertikal och månad*.
  - Allt org-scopat, alla `references(..., { onDelete: "cascade" })` enligt Mailmind-konvention.
- **Rör inte:** befintliga tabeller, inga ändringar i `users`/`subscriptions`/`licenseEntitlements`. Inga vertikalspecifika tabeller (`solar_*`/`construction_*`/`trades_*`) — de landar i sina respektive faser.
- **AC:**
  - `npm run db:generate` producerar en migration utan fel.
  - Schemat type-checker (`npm run typecheck`).
  - Manuell SQL i Neon kontrollerar att de tre tabellerna existerar med rätt index. *(Sebastian kör SQL — jag rör inte produktions-DB.)*
- **Verifiering:** `npm run typecheck && npm run lint`
- **Out-of-scope:** seeding av `products`-raderna (S0-3), entitlement-helpers (S0-2), UI (S0-4/S0-6).

---

## S0-2 · Entitlement-tillägg: `getProductAccess` + `AccessState.products`

- **§-ref:** §6.4, §8.1
- **Storlek:** M
- **Läs först:**
  - `src/lib/app/entitlements.ts` (hela filen — vi *utvidgar* den, ersätter inget)
  - `src/lib/app/entitlements.test.ts` (mönster för vitest-suite vi ska matcha)
  - `src/lib/db/queries.ts` `getPortalData` (vi behöver lägga till en JOIN/select för `org_product_access` här)
- **Ändrar / skapar:**
  - **Ändrar:** `src/lib/app/entitlements.ts` — utöka `AccountSnapshot` med `products: { [key: string]: { status, limits } }` samt en helper `hasProductAccess(account, key): boolean`.
  - **Ändrar:** `src/lib/db/queries.ts` — `getPortalData` läser även `org_product_access` för orgen.
  - **Skapar:** `src/lib/app/entitlements.products.test.ts` — vitest-suite enligt befintligt mönster.
- **AC:**
  - `hasProductAccess(account, 'solar')` returnerar `true` endast när `status` är `trialing` eller `active`.
  - `false` om raden saknas eller `disabled`.
  - Vitest passerar tre scenarier (active, trialing, missing).
  - `AccountSnapshot.products` är `{}` när DB saknar rader — bryter inte mock-läget.
- **Verifiering:** `npm run typecheck && npm run lint && npm test -- entitlements.products`
- **Out-of-scope:** koppling till Stripe-webhook (det är S5-territorium). Vi *läser* `org_product_access` här; vi *skriver* till det manuellt via SQL för pilot-tenants tills billing-integrationen byggs.

---

## S0-3 · Produktregister: `src/config/products.ts` + seed

- **§-ref:** §15, §20
- **Storlek:** S
- **Läs först:**
  - `docs/architecture/quoting-platform-architecture.md` §15 (PlatformModule-kontraktet)
  - `src/config/` (om mappen finns — annars skapas den nu)
- **Ändrar / skapar:**
  - **Skapar:** `src/config/products.ts` med en typad registry. Minimal `PlatformVertical`-shape nu (`key`, `displayName`, `navIcon`, `enabledByDefault: false`). Inte hela kontraktet i §15 — bara det S0/S1 behöver. Vi växer kontraktet när vi behöver det.
  - **Skapar:** `drizzle/seed-products.sql` — INSERTs för `mail`, `solar`, `construction`, `trades` i `products`-tabellen (alla fyra seedas redan nu eftersom de är registry-poster, inte aktiverade produkter — aktivering sker per tenant via `org_product_access`). Sebastian kör i Neon.
- **AC:**
  - `import { PRODUCTS } from '@/config/products'` ger `{ mail, solar, construction, trades }` med rätt typer (construction och trades markeras `placeholder: true` så S1-S5 UI inte försöker rendera dem).
  - Client-säker (ingen server-only import, ingen `"use server"`).
- **Verifiering:** `npm run typecheck`
- **Out-of-scope:** route-mounts, nav-rendering.

---

## S0-4 · Solar route-skelett: `(portal)/solar/layout.tsx` + `page.tsx`

- **§-ref:** §4, §8.1, §10
- **Storlek:** M
- **Läs först:**
  - `src/app/(portal)/layout.tsx` (eller motsvarande — befintligt portal-skal)
  - En befintlig portal-sida för att förstå rendering-mönstret
  - `src/app/api/app/templates/route.ts` (api lifecycle-mönstret — vi använder samma gating-ordning på sidor)
- **Ändrar / skapar:**
  - **Skapar:** `src/app/(portal)/solar/layout.tsx` — auth → account → `hasProductAccess('solar')`-gate → redirect till en "produkt inte aktiverad"-vy om `false`. Wrappar children i ett solar-shell (sidnav, brödsmulor — minimalt nu).
  - **Skapar:** `src/app/(portal)/solar/page.tsx` — placeholder-dashboard ("Solar-modulen aktiveras — funktioner kommer i S1").
- **AC:**
  - `/solar` (eller motsvarande URL beroende på portal-rooten) renderar för entitled org.
  - Icke-entitled org redirectas eller får 403-vy.
  - Mejl-flödet helt opåverkat.
- **Verifiering:** `npm run typecheck && npm run lint && npm run build` (build är extra här eftersom Next App Router fångar trasiga route-konfigurationer).
- **Out-of-scope:** allt solar-domäninnehåll. Detta är ett skelett.

---

## S0-5 · Import-boundary lint-regel

- **§-ref:** §3.4, §15
- **Storlek:** M
- **Läs först:**
  - `eslint.config.mjs` (befintlig konfig)
  - https://eslint.org/docs/latest/rules/no-restricted-imports (om jag behöver kolla syntax — annars använder jag mönster från ESLint 9 flat config jag redan kan)
- **Ändrar / skapar:**
  - **Ändrar:** `eslint.config.mjs` — lägg till regler som speglar §3.4 (`vertical → quoting-common → core`, aldrig omvänt, vertikaler får inte importera varandra):
    1. **Plattformskärnan får inte importera vertikaler eller quoting-common.** Filer utanför `src/lib/quoting-common/`, `src/lib/<vertical>/`, `src/app/(portal)/<vertical>/`, `src/app/api/quoting/`, `src/components/quoting-common/`, `src/components/<vertical>/` får inte importera från `@/lib/quoting-common/*`, `@/lib/solar/*`, `@/lib/construction/*`, `@/lib/trades/*`, eller motsvarande `components/*`.
    2. **Verticaler får inte importera varandra.** `src/lib/solar/**` får inte importera `@/lib/construction/*` eller `@/lib/trades/*` (och vice versa). Cross-vertikal kommunikation går via events i quoting-common.
    3. **Quoting-common får inte importera vertikaler.** `src/lib/quoting-common/**` får inte importera `@/lib/solar/*`, `@/lib/construction/*`, `@/lib/trades/*`. Beroende går enbart "uppåt" (vertikaler beror på common; aldrig tvärtom).
    4. **Routes/komponenter får inte gå förbi datalagret.** `src/app/(portal)/<vertical>/**` och `src/app/api/quoting/**` får inte importera `@/lib/db` direkt — måste gå via `@/lib/quoting-common/data/*` eller `@/lib/<vertical>/data/*`.
- **AC:**
  - `npm run lint` är grön på nuvarande kodbas.
  - Ett medvetet test (jag skapar en temp-fil med en otillåten import och kör lint, ser den failas, raderar filen) bekräftar att regeln triggar.
- **Verifiering:** `npm run lint`
- **Out-of-scope:** `src/lib/solar/data/*`-filerna själva (de byggs i S1).

---

## S0-6 · Nav-växlare (dark, bakom flagga)

- **§-ref:** §10
- **Storlek:** S/M
- **Läs först:**
  - Befintlig sidebar/topbar-komponent i `src/components/layout/` eller `src/components/portal/`
  - `src/config/products.ts` (S0-3)
  - Hur PostHog feature flags läses i kodbasen *(grep `posthog`-användning)*
- **Ändrar / skapar:**
  - **Skapar:** `src/components/portal/ProductSwitcher.tsx` — läser `account.products` server-side (via prop från en server-komponent), renderar dropdown/menu med entries från `PRODUCTS` filtrerat på `hasProductAccess` *och* `!placeholder` (så construction/trades inte syns innan de är byggda).
  - **Ändrar:** den befintliga portal-layouten — montera switchern. Gömd bakom env-flagga `QUOTING_NAV_ENABLED` (alt. PostHog flag `quoting_nav`). Default `false`.
- **AC:**
  - Med flaggan `false` är navigationen visuellt oförändrad.
  - Med flaggan `true` och entitled org visas switchern med "Mail" och "Solar" (de enda två icke-placeholder-produkterna i S0).
  - Med flaggan `true` men icke-entitled org visas bara "Mail".
  - När construction (S6) eller trades (S7) senare flippas från `placeholder: true` till `false` syns de automatiskt — utan kodändring i switchern.
- **Verifiering:** `npm run typecheck && npm run lint && npm run build`
- **Out-of-scope:** ikoner, polering, animation. Detta är funktion, inte design.

---

## S0-7 · Verifiering, ADR-uppdatering, project-state-sync

- **§-ref:** —
- **Storlek:** S
- **Läs först:**
  - `.claude/context/project-state.md` (för att se mönstret för "Vad som gjorts sedan senast")
- **Ändrar / skapar:**
  - **Ändrar:** `.claude/context/project-state.md` — ny sektion `### Fas S0 (solmodulen) — klar` med kort sammanfattning av landade tabeller, helpers, lint-regel, route-skelett, switcher-flagga.
  - **Ändrar:** `docs/architecture/decisions/0001-blocking-decisions.md` — bekräftar att B1/B2/B3 är `Decided` (om de inte redan markerats).
  - **Skapar (om värt):** `docs/architecture/decisions/0002-s0-summary.md` — ett kort ADR som loggar vad S0 levererade.
- **AC:**
  - `npm run typecheck && npm run lint && npm test` allt grönt.
  - `npm run build` grönt.
  - project-state återspeglar nuläget.
- **Verifiering:** ovanstående tre kommandon + manuell ögonsmoke i preview deploy.
- **Out-of-scope:** S1 (kärnoffert). När S0-7 är klar är fasen stängd.

---

## Sessionsregler (vi två)

1. **En task per session.** Om en task visar sig vara större än L när jag är inne i den — jag pausar, ber dig dela den, vi tar resten i nästa session.
2. **Jag rör inte produktions-DB.** All SQL som behöver köras mot Neon presenterar jag som ett snippet du kör i SQL Editor. Jag verkställer aldrig.
3. **Inga nya npm-paket utan motivering** (CLAUDE.md). Om en task hade behövt ett paket jag inte motiverat, pausar jag och frågar.
4. **`organizationId`-scope är heligt.** Jag commitar aldrig kod där en solar-query saknar org-scope. Cross-tenant-tester följer redan S1, men disciplinen börjar nu.
5. **Diff > prosa.** När jag rapporterar en task-färdigsignal beskriver jag *vad som ändrades och varför*, inte hur arbetet kändes. Du läser diffen i Cowork-vyn.
6. **Avvikelser eskaleras direkt.** Om jag under en task upptäcker att arkitekturdokumentet är fel eller att verkligheten i koden avviker (CLAUDE.md: "Kodbasen vinner över dokument") — pausar jag, rapporterar, du beslutar om dokumentet uppdateras eller om jag fortsätter.

---

## När Fas S0 är klar

Säg `Stäng S0` — då uppdaterar jag arkitekturdokumentets fasstatus, mergar lärdomar tillbaka i ADRs, och skissar S1-task-packet (`docs/architecture/tasks/phase-s1.md`).
