# Fas S3 — AI authoring layer · task-pack

> **För:** Sebastian + Claude (Claude Code). Varje task är skriven så att Claude kan komma in i en **fräsch session utan minne av tidigare arbete** och utföra uppgiften självständigt.
> **Refererar:** `docs/architecture/quoting-platform-architecture.md` §13.3, §13.4, §13.5, §8.1, §10.
> **Förutsättning:** Fas S2 klar (project-state.md bekräftar det). DB-migration S2 körd i Neon.
> **Beslut som låser S3:** B3 (KB-klassificering ✅), B5 (PVGIS SE-irradians ✅) — Decided i ADR 0001.
>
> **S3 levererar:**
> - KB API-route (CRUD, owner/admin-gatad, visibility-promotion audit-loggad).
> - Full egress-gate med rendered-text-scan (kompletterar S2-5 skelettet).
> - AI authoring layer (`lib/quoting-common/ai/`) — universell, vertical-agnostisk.
> - Solar prompt-fragment (`lib/solar/ai-prompts/`).
> - Solar quote-builder UI (takyta-editor + ROI-display + AI-draft-knapp).

---

## S3-1 · KB API-route

- **§-ref:** §8.1, §8.2, §13.4
- **Storlek:** M (~45 min)
- **Läs först:**
  - `src/lib/quoting-common/data/kb.ts` (S2-3 — data-lagret vi anropar)
  - `src/app/api/quoting/customers/route.ts` (livscykelmönster)
  - `src/lib/db/schema.quoting.ts` rad 422–512 (`quotingKbEntries`, `kbCategoryEnum`, `kbVisibilityEnum`)
  - `docs/architecture/quoting-platform-architecture.md` §13.4 (KB-arkitektur + audience-classification)
- **Ändrar / skapar:**
  - **Skapar:** `src/app/api/quoting/kb/route.ts` — `GET` + `POST`:
    - `GET`: query-params `?vertical=solar&visibility=customer_facing` (valfria). Returnerar `{ entries }`. Kräver inloggad `member+`.
    - `POST`: skapar ny KB-post. Kräver `owner`/`admin` (`requireOrgAdmin`). Zod-body: `{ title, body, category?, visibility?, vertical?, source? }`. `visibility` defaults till `internal_only` om ej angivet (fail-safe). Returnerar `{ entry }` med 201.
  - **Skapar:** `src/app/api/quoting/kb/[id]/route.ts` — `GET` + `PATCH` + `DELETE`:
    - `GET`: hämtar en post, `member+`.
    - `PATCH`: uppdaterar. Kräver `owner`/`admin`. Speciellt: om `visibility` ändras från `internal_only` → `customer_facing` ska en rad skrivas till `auditLogs` med `action: "kb.entry.promoted"` (använd `auditLogs`-funktionen från `src/lib/app/audit.ts`).
    - `DELETE`: raderar. Kräver `owner`/`admin`. Returnerar 204.
- **Rör inte:** AI-lagret, egress-gate, UI.
- **AC:**
  - `POST /api/quoting/kb` utan auth → 401.
  - `POST /api/quoting/kb` som `member` (inte admin) → 403.
  - `POST /api/quoting/kb` utan `visibility` → entry sparas med `visibility = 'internal_only'`.
  - `PATCH /api/quoting/kb/[id]` med `visibility: 'customer_facing'` → audit-log skapas.
  - `npm run typecheck && npm run lint && npm run build` gröna.
- **Verifiering:** `npm run typecheck && npm run lint && npm run build`
- **Out-of-scope:** pgvector-embedding, bulk-import, KB-UI.

---

## S3-2 · Egress-gate — full implementation

- **§-ref:** §13.5
- **Storlek:** S (~30 min)
- **Läs först:**
  - `src/lib/quoting-common/egress/gate.ts` (S2-5 — befintlig audience-filter-implementation)
  - `src/lib/quoting-common/egress/gate.test.ts` (befintliga 12 tester)
  - `docs/architecture/quoting-platform-architecture.md` §13.5 (fyra lager av egress-skydd)
- **Ändrar / skapar:**
  - **Ändrar:** `src/lib/quoting-common/egress/gate.ts` — lägg till `runEgressGate`:
    ```ts
    type EgressInput = { renderedText: string }
    type EgressResult = { ok: boolean; blockedReasons: string[] }
    function runEgressGate(
      input:         EgressInput,
      internalEntries: KbEntry[],   // caller injicerar KB-poster med visibility='internal_only'
    ): EgressResult
    ```
    - **Regel 1 — intern-data-scan:** iterera `internalEntries` (de som passerar `!isCustomerFacing`). För varje post: om `entry.body` är > 10 tecken och `input.renderedText.toLowerCase().includes(entry.body.slice(0, 60).toLowerCase())` → lägg till `'internal_data_detected'` i `blockedReasons` (en gång, inte per träff).
    - **Regel 2 — placeholder-scan:** om `renderedText` matchar regex `/\b(TODO|FIXME|\[FYLL I\]|\[INSERT\]|\[DATUM\])\b/i` → lägg till `'placeholder_detected'`.
    - `ok = blockedReasons.length === 0`.
    - Ren funktion — inga DB-importer, inga side effects.
  - **Ändrar:** `src/lib/quoting-common/egress/gate.test.ts` — lägg till 6 nya tester för `runEgressGate`:
    - Tom text + inga interna poster → `ok: true`.
    - Text innehåller "TODO" → `blocked: ['placeholder_detected']`.
    - Text innehåller exakt substring från en `internal_only`-post → `blocked: ['internal_data_detected']`.
    - Text innehåller substring från en `customer_facing`-post → `ok: true` (ej blockad).
    - Text utan matchningar + irrelevanta interna poster → `ok: true`.
    - Text med både placeholder och intern träff → `blockedReasons.length === 2`.
- **Rör inte:** befintliga 12 tester (de ska fortsätta passera), routes, UI.
- **AC:**
  - Totalt 18 tester (12 befintliga + 6 nya) — alla gröna.
  - `runEgressGate` är en ren funktion — inga `@/lib/db`-importer.
  - `npm run typecheck && npm run lint` passerar.
- **Verifiering:** `npm run typecheck && npm run lint && npm test -- gate`
- **Out-of-scope:** Produktionssättning av egress-gaten på send-route (S4). AI-confidence-gating (S3-3).

---

## S3-3 · AI authoring layer

- **§-ref:** §13.3
- **Storlek:** L (~90 min)
- **Läs först:**
  - `docs/architecture/quoting-platform-architecture.md` §13.3 (AI authoring layer — arkitektur + dataflöde)
  - `src/lib/solar/engine/types.ts` (S2-2 — `SolarEngineInputSchema`, `SolarEngineResult`)
  - `src/lib/solar/engine/roi.ts` (S2-2 — `runSolarRoi`)
  - `src/lib/quoting-common/data/kb.ts` (S2-3 — `listCustomerFacingEntries`)
  - `src/lib/quoting-common/egress/gate.ts` (S3-2 — `filterCustomerFacing`)
  - Befintlig AI-implementation i `src/lib/ai.ts` (mönster för Anthropic SDK + prompt-caching)
  - `package.json` — bekräfta att `@anthropic-ai/sdk` redan finns (Anthropic SDK är i stacken)
- **Ändrar / skapar:**
  - **Skapar:** `src/lib/quoting-common/ai/types.ts` — typer för AI authoring:
    ```ts
    export type AiDraftInput = {
      orgId:        string;
      quoteId:      string;
      vertical:     string;          // 'solar' | 'construction' | 'trades'
      customerName: string;
      scopeBrief:   string;          // fri text från säljaren, t.ex. "villa i Täby, 180m² södertak"
      kbEntries:    KbEntry[];       // customer_facing-poster (injiceras av caller)
      promptFragments?: string[];    // vertikalens prompt-fragment (injiceras av caller)
    }
    export type AiDraftResult = {
      narrativeText:    string;      // kundvändande offerttext
      proposedInputs:   Record<string, unknown>;  // strukturerade motor-inputs (t.ex. SolarEngineInput)
      confidence:       number;      // 0–1
      riskFlags:        string[];    // t.ex. ['missing_consumption', 'low_confidence']
      sourceEntryIds:   string[];    // vilka KB-poster som användes
      rawModel:         string;      // vilket modell-ID som användes
    }
    ```
  - **Skapar:** `src/lib/quoting-common/ai/author.ts` — `draftQuote(input: AiDraftInput): Promise<AiDraftResult>`:
    - Hämtar **inte** KB själv — caller (API-route) injicerar `kbEntries` (alla filtrerade till `customer_facing`).
    - Bygger system-prompt med: (1) instruktion om att vara hjälpsam solar-säljassistent, (2) vertikalens `promptFragments` (om givna), (3) KB-poster som grounding-kontext (max 8 poster, rubrik + body).
    - Bygger user-prompt med: customerName + scopeBrief.
    - Ber modellen svara i JSON (structured output-mönster från `ai.ts`):
      ```json
      {
        "narrativeText": "...",
        "proposedInputs": { ... },
        "confidence": 0.87,
        "riskFlags": [],
        "sourceEntryIds": ["e1", "e2"]
      }
      ```
    - Använder `claude-haiku-4-5-20251001` (samma modell som mail-AI, se `src/lib/ai.ts`).
    - Prompt caching: system-prompt med `cache_control: { type: "ephemeral" }` (SE mönster från ai.ts).
    - Confidence < 0.6 lägger till `'low_confidence'` i `riskFlags`.
    - Om JSON-parse misslyckas → returnerar `{ narrativeText: rawResponse, proposedInputs: {}, confidence: 0, riskFlags: ['parse_failed'], ... }`.
    - Returnerar alltid ett `AiDraftResult` — kastar aldrig.
  - **Skapar:** `src/lib/quoting-common/ai/author.test.ts` — 5 vitest-tester med mockad Anthropic:
    - `draftQuote` med giltig respons → returnerar `AiDraftResult` med rätt fält.
    - `draftQuote` med confidence < 0.6 → `riskFlags` innehåller `'low_confidence'`.
    - `draftQuote` om modellen svarar med ogiltig JSON → returnerar `parse_failed`-flagga utan att kasta.
    - `draftQuote` injicerar inte `internal_only`-poster (testa att caller-injicerade poster faktiskt används).
    - `draftQuote` inkluderar `promptFragments` i system-promptet.
- **Rör inte:** Solar-motor (ren funktion), routes, UI, KB-data-lagret.
- **AC:**
  - `author.ts` har **inga** direktimporter från `@/lib/db` eller `@/lib/app/entitlements`.
  - Alla 5 tester gröna.
  - `npm run typecheck && npm run lint` passerar.
- **Verifiering:** `npm run typecheck && npm run lint && npm test -- author`
- **Out-of-scope:** Integration med Solar-API-route (S3-4), PDF (S4), autosvar (S4).

---

## S3-4 · Solar prompt-fragment + AI-calculate-route

- **§-ref:** §13.3, §15
- **Storlek:** M (~50 min)
- **Läs först:**
  - `src/lib/quoting-common/ai/author.ts` (S3-3 — `draftQuote`)
  - `src/lib/quoting-common/data/kb.ts` (S2-3 — `listCustomerFacingEntries`)
  - `src/lib/solar/engine/types.ts` (S2-2 — `SolarEngineInputSchema`)
  - `src/lib/solar/engine/roi.ts` (S2-2 — `runSolarRoi`)
  - `src/app/api/quoting/solar/calculate/route.ts` (S2-4 — befintlig beräkningsroute)
- **Ändrar / skapar:**
  - **Skapar:** `src/lib/solar/ai-prompts/solar.ts` — Solar-specifika prompt-fragment:
    ```ts
    export const SOLAR_PROMPT_FRAGMENTS: string[] = [
      "Du är en expert på solcellsinstallationer i Sverige...",
      "Viktigt vokabulär: takyta (roof surface), tilt/lutning (degrees), azimut (180=söder), kWp (installerad effekt), kWh/år (produktion), ROT-avdrag (30% av arbete, max 50 000 kr), återbetalningstid, NPV, IRR, CO₂-besparing.",
      "När du föreslår motor-inputs för Solar, strukturera `proposedInputs` enligt SolarEngineInput: { surfaces: [{area, tilt, azimuth, shading}], systemCapacityKwp, annualConsumptionKwh, systemCostSek }.",
      "Om scopeBriefet saknar takinformation, fråga inte — sätt shading=0, tilt=35, azimuth=180 som rimliga defaults och flagga 'missing_roof_details' i riskFlags.",
    ];
    ```
  - **Ändrar:** `src/app/api/quoting/solar/calculate/route.ts` — lägg till valfritt AI-draft-läge:
    - Om request-body innehåller `{ mode: "ai_draft", customerName: string, scopeBrief: string }` (i stället för direkta engine-inputs):
      1. Hämta `customer_facing` KB-poster via `listCustomerFacingEntries(orgId, 'solar')`.
      2. Anropa `draftQuote({ ..., kbEntries, promptFragments: SOLAR_PROMPT_FRAGMENTS })`.
      3. Validera `parsedResult.proposedInputs` mot `SolarEngineInputSchema.safeParse()`.
      4. Om valid: kör `runSolarRoi(parsedInputs)` + spara scenario.
      5. Returnera `{ scenarioId, result, aiDraft: { narrativeText, confidence, riskFlags } }`.
      6. Om `SolarEngineInputSchema` inte validerar → returnera `{ error: 'ai_inputs_invalid', aiDraft }` med 422.
    - Befintligt direktläge (mode saknas eller mode=`direct`) beter sig exakt som S2-4.
- **Rör inte:** Solar-motorn (ren funktion), UI, PDF.
- **AC:**
  - `POST /api/quoting/solar/calculate` med `mode: "ai_draft"` och giltig `scopeBrief` → returnerar `result.annualProductionKwhY1 > 0` (givet att AI-draft producerar valida inputs).
  - `POST /api/quoting/solar/calculate` med direktläge (utan mode) beter sig precis som S2-4.
  - `npm run typecheck && npm run lint && npm run build` gröna.
- **Verifiering:** `npm run typecheck && npm run lint && npm run build`
- **Out-of-scope:** Solar UI (S3-5), PDF (S4), KB-UI.

---

## S3-5 · Solar quote-builder UI

- **§-ref:** §10, §4
- **Storlek:** L (~80 min)
- **Läs först:**
  - `src/app/(portal)/solar/quotes/page.tsx` (S1-5 — befintlig quotes-lista)
  - `src/app/(portal)/solar/page.tsx` (S1-5 — dashboard)
  - `src/lib/solar/engine/types.ts` (S2-2 — typer för visning)
  - `src/components/quoting-common/QuoteStatusBadge.tsx` (S1-5 — mönster för komponenter)
- **Ändrar / skapar:**
  - **Skapar:** `src/components/solar/RoofSurfaceForm.tsx` — klient-komponent:
    - Formulär för att lägga till / redigera ett takfält: `area` (m²), `tilt` (°, 0–90), `azimuth` (°, default 180 = söder), `shading` (%, konverteras till 0–1), `label` (valfritt namn).
    - Enkel validering: area > 0, tilt 0–90, azimuth 0–360.
    - Prop: `onSave(surface: RoofSurface): void`, `onCancel(): void`, `initial?: RoofSurface`.
  - **Skapar:** `src/components/solar/RoiResultCard.tsx` — klient-komponent:
    - Visar `SolarEngineResult`-fält på ett snyggt kort:
      - Produktion: `annualProductionKwhY1` kWh/år
      - Egenanvändning: `selfConsumptionRate` (%)
      - Besparing år 1: `annualSavingsSekY1` kr
      - Återbetalningstid: `paybackYears` år
      - NPV (20 år): `npv` kr
      - CO₂-besparing: `co2AvoidedKgPerYearY1` kg/år
      - ROT-avdrag: `rotDeductionSek` kr
    - Props: `result: SolarEngineResult`, `loading?: boolean` (skeleton om true).
  - **Skapar:** `src/app/(portal)/solar/quotes/[id]/page.tsx` — server-komponent (quote-detalj):
    - Auth → account → `hasProductAccess('solar')` → hämta quote + senaste scenario (om finns).
    - Renderar: quote-nummer, status (QuoteStatusBadge), kundnamn, skapad-datum.
    - Om scenario finns: renderar `<RoiResultCard result={scenario.results} />`.
    - Om inget scenario: renderar ett formulär-section med `<RoofSurfaceForm>` och en "Beräkna" (klient-knapp).
    - "Beräkna"-knappen anropar `POST /api/quoting/solar/calculate` med direktläge och uppdaterar vyn med resultatet.
  - **Ändrar:** `src/app/(portal)/solar/quotes/page.tsx` — länka varje rad i listan till `/solar/quotes/[id]`.
- **Rör inte:** AI-draft-UI (kan läggas till senare), PDF (S4), signering (S5).
- **AC:**
  - `/solar/quotes/[id]` renderar utan fel för ett existerande solar-quote.
  - `RoofSurfaceForm` validerar area > 0 client-side.
  - `RoiResultCard` visar skeleton om `loading=true`.
  - `npm run typecheck && npm run lint && npm run build` gröna.
- **Verifiering:** `npm run typecheck && npm run lint && npm run build`
- **Out-of-scope:** AI-draft-knapp i UI (prio 2 — S3-4 täcker API), mobil-polish, PDF-download.

---

## S3-6 · Verifiering, docs-sync, project-state

- **§-ref:** —
- **Storlek:** S (~20 min)
- **Läs först:**
  - `.claude/context/project-state.md`
- **Ändrar / skapar:**
  - **Ändrar:** `.claude/context/project-state.md` — ny sektion `### Fas S3 — klar` + roadmap-rad `Fas S3 ✅`.
  - **Skapar:** `docs/architecture/tasks/phase-s4.md` — sketcha S4-task-packet (se nedan).
- **AC:**
  - `npm run typecheck` ✅
  - `npm run lint` ✅
  - `npm test` ✅ (alla befintliga + S3-nya)
  - `npm run build` ✅
- **Verifiering:** `npm run typecheck && npm run lint && npm test && npm run build`

---

## Sessionsregler (identiska med S0/S1/S2)

1. En task per session. Uppstår en task > L — pausa och dela den.
2. Rör inte produktions-DB. SQL-snippets presenteras; Sebastian kör i Neon.
3. Inga nya npm-paket utan motivering.
4. `organizationId`-scope är heligt.
5. Avvikelser eskaleras direkt.

---

## S3 DB-migration (om nödvändig)

S3 lägger inga nya tabeller — alla tabeller skapades i S2. Ingen Neon-körning krävs.

---

## När Fas S3 är klar

Säg `Stäng S3` — Claude uppdaterar project-state, stänger fas, skissar S4-task-packet.

**S4 skissar:**
- PDF-generering (asynkron QStash-job → Vercel Blob → `quoting_documents`).
- Universal PDF-layout (base template) + Solar-overlay (ROI-sektion).
- `POST /api/quoting/quotes/[id]/pdf` + `POST /api/quoting/quotes/[id]/send`.
- Full produktionssättning av egress-gate på send-route.
- B6 (PDF-renderer-val) behöver beslutas innan S4 startar — `@react-pdf/renderer` vs Puppeteer vs `pdfmake`. Rekommendation: `@react-pdf/renderer` (React-komponentbaserad, serverless-vänlig, ingen headless Chrome).
