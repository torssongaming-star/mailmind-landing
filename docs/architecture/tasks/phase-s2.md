# Fas S2 — KB + Solar engine substrate · task-pack

> **För:** Sebastian + Claude (Claude Code). Varje task är skriven så att Claude kan komma in i en **fräsch session utan minne av tidigare arbete** och utföra uppgiften självständigt.
> **Refererar:** `docs/architecture/quoting-platform-architecture.md` §6.2, §6.3, §13.1, §13.2, §13.4, §13.5.
> **Förutsättning:** Fas S1 klar (ADR 0002 + project-state.md bekräftar det).
> **Beslut som låser S2:** B3 (entry-nivå KB-klassificering ✅), B5 (PVGIS + Nord Pool ✅) — Decided i ADR 0001.
>
> **S2 levererar:**
> - `quoting_kb_entries` — universal KB-tabell med `visibility`-klassificering.
> - Solar extension tables — `solar_properties`, `solar_quote_extension`, `solar_roi_scenarios`.
> - Solar ROI-motor — deterministisk, versionerad ren funktion med SE VAT/ROT-stöd.
> - KB data-lager med audience-filtering.
> - Solar calculate API-route.
> - Solar properties API-route.
> - Egress-gate skeleton — universal outbound-valideringsport.

---

## S2-1 · DB-scheman: `quoting_kb_entries` + Solar extension tables

- **§-ref:** §6.2, §6.3
- **Storlek:** M (~50 min)
- **Läs först:**
  - `src/lib/db/schema.quoting.ts` (befintliga tabeller — konventioner, enums)
  - `src/lib/db/schema.ts` rad 1–20 (import-mönster)
  - `docs/architecture/quoting-platform-architecture.md` §6.2 (quoting_kb_entries) + §6.3 (solar_*)
- **Ändrar / skapar:**
  - **Ändrar:** `src/lib/db/schema.quoting.ts` — lägg till `quoting_kb_entries`:
    - `(id, organizationId FK cascade, title varchar, body text, category kbCategoryEnum, visibility kbVisibilityEnum NOT NULL DEFAULT 'internal_only', vertical varchar NULL, embedding vector NULL, source varchar NULL, createdBy uuid NULL, createdAt, updatedAt; idx(organizationId), idx(organizationId, vertical), idx(organizationId, visibility))`
    - Enums: `kbCategoryEnum` (`faq|policy|spec|caveat|other`), `kbVisibilityEnum` (`internal_only|customer_facing`).
    - Default är `internal_only` (fail-safe — måste explicit promotas).
  - **Skapar:** `src/lib/db/schema.solar.ts` — Solar extension tables:
    - `solar_properties` — `(id, organizationId FK cascade, customerId FK→quoting_customers NULL, address jsonb NULL, roofSurfaces jsonb $type<RoofSurface[]>, imagerySource varchar NULL, imageryRef jsonb NULL, createdAt, updatedAt; idx(organizationId), idx(customerId))`
    - `solar_quote_extension` — `(id, organizationId FK cascade, quoteId FK→quoting_quotes UNIQUE cascade, propertyId FK→solar_properties NULL, meta jsonb NULL, createdAt, updatedAt; uniqueIdx(quoteId))`
    - `solar_roi_scenarios` — `(id, organizationId FK cascade, quoteId FK→quoting_quotes cascade, engineVersion varchar, inputs jsonb, results jsonb, createdAt; idx(quoteId), idx(organizationId))`
    - Exportera typen `RoofSurface = { area: number; tilt: number; azimuth: number; shading: number }`.
  - **Ändrar:** `src/lib/db/schema.ts` — lägg till `export * from "./schema.solar"` (under befintlig quoting-re-export).
- **Rör inte:** befintliga tabeller, inga ändringar i mail-schema, inga routes.
- **AC:**
  - `npm run typecheck` passerar.
  - Alla Solar-tabeller och KB-tabellen exporteras från `schema.ts`.
  - `kbVisibilityEnum` default är `internal_only`.
- **Verifiering:** `npm run typecheck && npm run lint`
- **Out-of-scope:** queries, engine, routes, UI.

---

## S2-2 · Solar ROI-motor (deterministisk, versionerad)

- **§-ref:** §13.1, §13.2
- **Storlek:** L (~90 min)
- **Läs först:**
  - `docs/architecture/quoting-platform-architecture.md` §13.1 (universal engine principles) + §13.2 (Solar engine spec)
  - `src/lib/quoting-common/domain/types.ts` (mönster för domäntyper)
  - `src/lib/db/schema.solar.ts` (S2-1 — `RoofSurface`, `solar_roi_scenarios`)
- **Ändrar / skapar:**
  - **Skapar:** `src/lib/solar/engine/types.ts` — Zod-scheman + TypeScript-typer:
    - `RoofSurfaceInput` — `{ area: number, tilt: number, azimuth: number, shading: number }` (ett takfält)
    - `SolarEngineInput` — `{ surfaces: RoofSurfaceInput[], systemLossFraction: number, panelEfficiency: number, systemCapacityKwp: number, annualConsumptionKwh: number, electricityPriceSekPerKwh: number, feedInTariffSekPerKwh: number, systemCostSek: number, includeRot: boolean, rotPercentage: number, rotMaxSek: number, degradationRatePerYear: number, analysisYears: number }` — alla fält med Zod default-värden för SE-marknaden.
    - `SolarEngineResult` — `{ annualProductionKwh: number, selfConsumptionKwh: number, feedInKwh: number, selfConsumptionRate: number, annualSavingsSek: number, paybackYears: number, npv20Years: number, irr: number, co2AvoidedKgPerYear: number, rotDeductionSek: number, netSystemCostSek: number, yearlyData: Array<{ year: number, production, savings, cumulativeSavings }> }`
    - `ENGINE_VERSION = "solar-roi@1.0.0"` som exporterad konstant.
  - **Skapar:** `src/lib/solar/engine/roi.ts` — ren beräkningsfunktion:
    - `runSolarRoi(input: SolarEngineInput): SolarEngineResult`
    - **Produktionsmodell:** kWh/år = Σ(area × panelEfficiency × irradianceForTiltAzimuth × (1 − shading) × (1 − systemLoss)) × (1 − degradation)^year. Använd en enkel irradiance-tabell för Sverige (lat ~59°N): base irradiance 980 kWh/m²/år, tilt-faktor för 0°–60° och azimuth-korrektion (söder=1.0, öster/väster=0.88, norr=0.7).
    - **Självkonsumtion:** min(production, consumption × 0.7) som approximation om ingen load-profile ges.
    - **Ekonomi:** savings = selfConsumption × electricityPrice + feedIn × feedInTariff. PaybackYear = netSystemCost / annualSavings. NPV(20 år) med diskonteringsränta 4 %. IRR via bisektionsmetod (max 50 iterationer).
    - **ROT:** rotDeduction = min(systemCost × 0.3 × rotPercentage, rotMaxSek) om `includeRot=true`. Swedish ROT: 30 % av arbetskostnad, max 50 000 kr/person — som standard parameters.
    - **CO₂:** 0.045 kg CO₂/kWh (SE mix 2025).
    - Pure function — inga side effects, ingen I/O, inget DB.
  - **Skapar:** `src/lib/solar/engine/roi.test.ts` — vitest-tester:
    - 100 m² södertak, tilt 35°, inga skuggor → productionKwh > 0.
    - Högt systemkostnad → paybackYears > 5.
    - includeRot=true → rotDeductionSek > 0.
    - npv20Years beräknas (kan vara negativt för högt pris — kontrollera bara att det är ett tal).
    - Deterministisk: samma input → identiskt output.
    - Minst 8 tester.
- **Rör inte:** DB, routes, UI, quoting-common.
- **AC:**
  - Motorn är en ren funktion — inga imports från `@/lib/db` eller `@/lib/app`.
  - Alla tester gröna.
  - `npm run typecheck` passerar.
- **Verifiering:** `npm run typecheck && npm run lint && npm test -- roi`
- **Out-of-scope:** PVGIS API-anrop (inga externa HTTP-anrop i motorn — irradiance är hårdkodad nu, PVGIS-integration landas när vi har ett konto). ROT-kalkylator UI.

---

## S2-3 · KB data-lager + audience-filtering

- **§-ref:** §13.4
- **Storlek:** S (~30 min)
- **Läs först:**
  - `src/lib/db/schema.quoting.ts` — `quoting_kb_entries` (S2-1)
  - `src/lib/quoting-common/data/customers.ts` (mönster för data-layer-queries)
  - `docs/architecture/quoting-platform-architecture.md` §13.4 (KB architecture + grounding rules)
- **Ändrar / skapar:**
  - **Skapar:** `src/lib/quoting-common/data/kb.ts`:
    - `listKbEntries(orgId, opts?: { vertical?, visibility? }): Promise<KbEntry[]>`
    - `getKbEntry(orgId, id): Promise<KbEntry | null>`
    - `createKbEntry(orgId, input): Promise<KbEntry>`
    - `updateKbEntry(orgId, id, patch): Promise<KbEntry | null>`
    - `deleteKbEntry(orgId, id): Promise<void>`
    - `listCustomerFacingEntries(orgId, opts?: { vertical? }): Promise<KbEntry[]>` — alias för `listKbEntries` med `visibility='customer_facing'` hårdkodad. Används av AI-authoring-lagret för grounding — aldrig ska returnera `internal_only`-poster.
  - **Ändrar:** `src/lib/quoting-common/domain/types.ts` — lägg till `KbEntry`-typ + `KbCategory` + `KbVisibility` union types.
- **Rör inte:** AI-authoring-lagret (S3), routes.
- **AC:**
  - `listCustomerFacingEntries` kan aldrig returnera `internal_only`-poster (strukturellt omöjligt — `visibility='customer_facing'` i WHERE).
  - Alla queries org-scopade.
  - `npm run typecheck` passerar.
- **Verifiering:** `npm run typecheck && npm run lint`
- **Out-of-scope:** `/api/quoting/kb` route (kan läggas i S2-4 som bonus eller S3).

---

## S2-4 · Solar API-routes: calculate + properties

- **§-ref:** §8.1, §8.2
- **Storlek:** M (~60 min)
- **Läs först:**
  - `src/app/api/quoting/quotes/route.ts` (livscykel-mönster)
  - `src/lib/solar/engine/roi.ts` (S2-2 — motorn vi ska anropa)
  - `src/lib/db/schema.solar.ts` (S2-1 — tabellerna vi skriver till)
  - `src/lib/quoting-common/data/quotes.ts` — `getQuote` (vi validerar att quoteId hör till org + vertical='solar')
- **Ändrar / skapar:**
  - **Skapar:** `src/lib/solar/data/properties.ts` — Drizzle-queries:
    - `listProperties(orgId): Promise<SolarProperty[]>`
    - `getProperty(orgId, id): Promise<SolarProperty | null>`
    - `createProperty(orgId, input): Promise<SolarProperty>`
    - `updateProperty(orgId, id, patch): Promise<SolarProperty | null>`
    - `SolarProperty`-typ exporteras (inferred från schema).
  - **Skapar:** `src/lib/solar/data/scenarios.ts`:
    - `createRoiScenario(orgId, quoteId, input, result, engineVersion): Promise<void>` — skriver till `solar_roi_scenarios`.
    - `listRoiScenarios(orgId, quoteId): Promise<SolarRoiScenario[]>`.
  - **Skapar:** `src/app/api/quoting/solar/calculate/route.ts` — `POST`:
    - Auth → account → `hasProductAccess(account, 'solar')` → zod.
    - Body: `{ quoteId: uuid, surfaces: RoofSurfaceInput[], ...övriga SolarEngineInput-fält med defaults }`
    - Validerar att `quoteId` tillhör orgen och att `quote.vertical === 'solar'`.
    - Kör `runSolarRoi(input)` (ren synkron funktion).
    - Sparar scenario till `solar_roi_scenarios` via `createRoiScenario`.
    - Returnerar `{ scenario: { engineVersion, results } }`.
  - **Skapar:** `src/app/api/quoting/solar/properties/route.ts` — `GET` (list) + `POST` (create).
    - GET: `listProperties(orgId)` → `{ properties }`.
    - POST zod: `{ customerId?, address?, roofSurfaces: RoofSurfaceInput[] }`.
- **Rör inte:** PDF (S4), AI-authoring (S3), KB-route.
- **AC:**
  - `POST /api/quoting/solar/calculate` med giltigt `quoteId` och rimliga sol-inputs returnerar `{ scenario.results.annualProductionKwh }` > 0.
  - `POST /api/quoting/solar/calculate` med `quoteId` som tillhör annan org → 404.
  - `npm run typecheck && npm run lint && npm run build` gröna.
- **Verifiering:** `npm run typecheck && npm run lint && npm run build`
- **Out-of-scope:** PDF-generering, email-utskick, BankID-signering.

---

## S2-5 · Egress-gate skeleton

- **§-ref:** §13.5
- **Storlek:** S (~25 min)
- **Läs först:**
  - `docs/architecture/quoting-platform-architecture.md` §13.5 (egress-gate defense in depth)
  - `src/lib/quoting-common/data/kb.ts` (S2-3 — `listCustomerFacingEntries`)
- **Ändrar / skapar:**
  - **Skapar:** `src/lib/quoting-common/egress/gate.ts`:
    - `type EgressCheckInput = { orgId: string; quoteId: string; renderedText: string }`
    - `type EgressCheckResult = { ok: boolean; blockedReasons: string[] }`
    - `runEgressGate(input: EgressCheckInput, orgKbEntries: KbEntry[]): EgressCheckResult` — **ren funktion** (ingen DB-åtkomst inne i funktionen — KB-poster injiceras som parameter).
    - **Regel 1:** `renderedText` innehåller inte exakta ord/fraser från `internal_only`-poster (enkel substring-check mot `entry.body` för poster med `visibility='internal_only'`). Hit → `blockedReasons.push('internal_data_detected')`.
    - **Regel 2:** Placeholder-texter som `TODO`, `FIXME`, `[FYLL I]`, `[INSERT]` i `renderedText` → `blockedReasons.push('placeholder_detected')`.
    - `ok = blockedReasons.length === 0`.
  - **Skapar:** `src/lib/quoting-common/egress/gate.test.ts` — 6 vitest-tester:
    - Tom text → ok.
    - Text med TODO → blocked med `placeholder_detected`.
    - Text med exakt substring från en `internal_only`-post → blocked.
    - Text med substring från `customer_facing`-post → ok (ej blockad).
    - Text utan matchningar → ok.
    - Flera blockers → `blockedReasons.length > 1`.
- **Rör inte:** Send-route (S4), PDF (S4). Enbart logiken, inga routes.
- **AC:**
  - Ren funktion — inga imports från `@/lib/db`.
  - Alla 6 tester gröna.
  - `npm run typecheck` passerar.
- **Verifiering:** `npm run typecheck && npm run lint && npm test -- gate`
- **Out-of-scope:** Full produktionssättning av egress-gaten (S4), AI-confidence-gating (S3).

---

## S2-6 · Verifiering, docs-sync, project-state

- **§-ref:** —
- **Storlek:** S (~20 min)
- **Läs först:**
  - `.claude/context/project-state.md`
- **Ändrar / skapar:**
  - **Ändrar:** `.claude/context/project-state.md` — ny sektion `### Fas S2 — klar` + roadmap-rad `Fas S2 ✅`.
- **AC:**
  - `npm run typecheck` ✅
  - `npm run lint` ✅
  - `npm test` ✅ (alla befintliga + S2-nya)
  - `npm run build` ✅
- **Verifiering:** `npm run typecheck && npm run lint && npm test && npm run build`
- **Out-of-scope:** S3. När S2-6 är klar är fasen stängd.

---

## Sessionsregler (identiska med S0/S1)

1. En task per session. Uppstår en task > L — pausa och dela den.
2. Rör inte produktions-DB. SQL-snippets presenteras; Sebastian kör i Neon.
3. Inga nya npm-paket utan motivering.
4. `organizationId`-scope är heligt.
5. Avvikelser eskaleras direkt.

---

## När Fas S2 är klar

Säg `Stäng S2` — Claude uppdaterar project-state, stänger fas, skissar S3-task-packet.
