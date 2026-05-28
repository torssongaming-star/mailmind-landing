# ADR 0001 — Blockerande arkitekturbeslut för quoting-plattformen

> **Status:** **Decided 2026-05-28** (B1–B7, B9 enligt rekommendationer; B8 deferred till S6/S7).
> **Skapat:** 2026-05-28.
> **Refererar:** `docs/architecture/quoting-platform-architecture.md` §21.
>
> Detta dokument samlar de beslut som **måste sitta innan första tabell skapas eller första route mountas**. Varje beslut har min rekommendation, motivering, konsekvens av att skjuta upp, och en `Status`-rad du fyller i när du valt. När de blockerande (B1–B3, B9) är `Decided` är vi klara att starta Fas S0.
>
> **2026-05-28 uppdatering:** dokumentet är reviderat efter beslutet att stödja tre vertikaler från start (Solar + Construction + Trades) via en delad `lib/quoting-common/`. B1 är omformulerad, B9 är nytt, B8 är nytt (kan deferas).

---

## Hur du läser och stänger besluten

Per beslut:

1. Läs `Fråga`, `Alternativ`, `Min rekommendation`, `Varför`.
2. Fyll i `Status:` med `Decided: <ditt val>` och en datumrad. Om du vill avvika från min rekommendation, skriv kort varför — det blir framtidens kontext.
3. När alla blockerande (B1–B3) är `Decided` startar S0. B4–B7 låser senare faser; vi tar dem när de blockerar.

---

## B1 — Var bor "kund"? (§3.2, §6.2)

> **Omformulerad 2026-05-28** efter beslutet att stödja tre vertikaler från start (Solar + Construction + Trades) med en delad quoting-common-modul. Tidigare versionen av detta beslut är obsolet.

**Fråga:** Eftersom *alla tre* vertikaler behöver en kund-modell (Bosse Bygg har samma slutkunder oavsett om de säljer sol eller entreprenad), var ska "Customer" bo?

**Alternativ:**

- **A. I quoting-common (`quoting_customers`)** — universell kund-tabell ägs av den delade quoting-modulen och återanvänds av alla vertikaler inom samma tenant. En framtida länk till en plattforms-bred `contacts`-tabell hanteras via `sharedContactId uuid NULL`.
- **B. Per vertikal (`solar_customers`, `construction_customers`, `trades_customers`)** — varje vertikal äger sin egen kund-tabell, även om de är 95 % identiska.

**Min rekommendation:** **A. I quoting-common.**

**Varför:** Detta är den exakta typ av delning middle-ground-valet (modul per bransch + delad quoting-common) är till för. Per-vertikal-kunder skulle betyda att en tenant som säljer både sol och entreprenad till samma slutkund har två separata kundrader — duplicering på en av de mest centrala entiteterna, och en katastrof för cross-vertical sökning, analyser, GDPR-export. Universell `quoting_customers` med tenant-scope löser detta naturligt. `sharedContactId` lämnas NULL nu, kan länkas till en framtida plattforms-bred `contacts` (om/när mejl-modulen vill referera samma entitet).

**Konsekvens om uppskjuten:** S1 (quoting-common kärna) kan inte starta — `quoting_customers`-tabellen måste landa innan offert-aggregatet bygger på den.

**Status:** _Decided 2026-05-28: **A — `quoting_customers` i quoting-common.** Per rekommendation._

---

## B2 — Billing-modell: solar som add-on på samma Stripe-prenumeration eller separat (§2, §6.4, §18)

**Fråga:** När en tenant har både mejl och solar — är det en Stripe-prenumeration med solar som extra prisrad/add-on, eller en separat prenumeration per produkt?

**Alternativ:**

- **A. En subscription, solar som add-on price** — samma Stripe customer, samma faktura, solar-tillgång drivs av `org_product_access` styrt av subscription metadata eller en specifik price-rad.
- **B. En subscription per produkt** — solar är en egen Stripe subscription, egen faktura.

**Min rekommendation:** **A. En subscription, solar som add-on price.**

**Varför:** Mailmind har redan modellen "en sub per org" (`subscriptions.organizationId` UNIQUE i praktiken via index, `plan` enum) och Stripe-flödet (checkout, portal, webhooks) är byggt runt det. Att introducera flera subs öppnar synkroniseringsfrågor (vad händer om mejl-subben är `active` men solar är `past_due`?). En subscription med add-on price håller billing-mental-modellen enkel: *"en kund, en faktura, produktåtkomst styrs av entitlement-lagret"*. Konsistent med "Single source of truth per concern" från §0.

**Konsekvens om uppskjuten:** S0 kan inte slutföras — `org_product_access` behöver veta hur det mappas mot Stripe innan vi seedar det.

**Status:** _Decided 2026-05-28: **A — en Stripe-subscription per org, vertikaler som add-on prices.** Per rekommendation._

---

## B3 — KB-klassificeringens granularitet (§13.5)

**Fråga:** Ska synligheten (`internal_only` / `customer_facing`) sitta på *entry-nivå* eller även på *fält-nivå* (t.ex. en produkt-post där `spec` är kundvänligt men `cost` är internt)?

**Alternativ:**

- **A. Entry-nivå nu** — en `visibility`-kolumn per KB-post. Inköpspriser/marginaler hålls som *strukturerade motorindata* i `solar_products` / prislistan, inte som KB-prosa.
- **B. Fält-nivå från start** — varje fält i en KB-post markeras separat.

**Min rekommendation:** **A. Entry-nivå nu.**

**Varför:** Fält-nivå-klassificering låter exakt men introducerar tre problem direkt: (1) UI-komplexitet (vem markerar vilket fält?), (2) AI-grundningens redactor blir betydligt mer komplex, (3) egress-kontrollen måste resonera om fält istället för innehåll. Genom att hålla *känsliga tal som strukturerad motordata* (kostnad lever i `solar_products.cost`, inte i ett KB-textfält) försvinner det stora behovet av fält-nivå nästan helt. Entry-nivå räcker för "interna riktlinjer / kunddokumentation"-skillnaden, vilket är det faktiska användningsfallet. Promotion till fält-nivå är en additiv migration om det visar sig behövas.

**Konsekvens om uppskjuten:** S2 (motor + KB) kan inte starta — KB-tabellens schema måste landa innan AI-grundningen designas.

**Status:** _Decided 2026-05-28: **A — entry-nivå-klassificering.** Per rekommendation. Känsliga tal hålls som strukturerade motorindata, inte som KB-prosa._

---

## Icke-blockerande för S0, men låser senare faser

Dessa behöver beslutas innan respektive fas startar — inte imorgon.

### B4 — Quote-numreringsschema (blockerar S1)

**Rekommendation:** Per-org sekvens, format `OFF-YYYY-NNNN` med årlig reset (matchar svensk fakturapraxis). Lagras i en `quoting_quote_number_sequences`-tabell med rad per `(organizationId, year)` och `last_used int`, uppdaterad transaktionellt vid quote-skapande. *(Tabellprefix `quoting_` istället för `solar_` eftersom numreringen är universell över vertikaler — landade i ADR-revisionen 2026-05-28.)*

**Status:** _Decided 2026-05-28: **Per rekommendation** — `OFF-YYYY-NNNN` per org med årlig reset i `quoting_quote_number_sequences`._

### B5 — ROI-datakällor (blockerar S2)

**Rekommendation:** **Solinstrålning:** PVGIS (EU Joint Research Centre, öppna data, har Sverige-täckning) som primär; SMHI som fallback. **Elpris:** Nord Pool spot-historik som baslinje + tenant-konfigurerbar override (Bosse vet sina kunders avtal). **Versionering:** assumptions paketeras med `engineVersion` (§13.1) så gamla offerter förblir reproducerbara även när vi byter datakälla.

**Status:** _Decided 2026-05-28: **Per rekommendation** — PVGIS primär + SMHI fallback för solinstrålning; Nord Pool spot + tenant-override för elpris; versionerat via `engineVersion`._

### B6 — PDF-renderare (blockerar S4)

**Rekommendation:** Headless Chromium via `@sparticuz/chromium` + `puppeteer-core` (fungerar på Vercel serverless, hög fidelitet för CSS-tunga offertmallar). Ja, det är ett tungt beroende — men det är jobbet S4 är till för, och CLAUDE.md:s "inga nya paket utan motivering" uppfylls eftersom alternativen (`pdfkit`, `react-pdf`) ger sämre fidelitet för komplexa mallar. Beslutet *behöver inte tas nu* — bara innan S4.

**Status:** _Decided 2026-05-28: **Per rekommendation** — `@sparticuz/chromium` + `puppeteer-core`. Paketinstallation och motivering sker i S4, inte tidigare._

### B7 — Egress-grindens strikthet (blockerar S4)

**Rekommendation:** **Hard-block** vid utskick om internt-data-scannern ger träff — offerten routas till människa för granskning, skickas aldrig automatiskt. Matchar plattformens defensiva grundhållning (samma logik som mejl-AI:ns confidence < 90 %-väg). Falska positiva accepteras som kostnad för att aldrig läcka.

**Status:** _Decided 2026-05-28: **Per rekommendation** — hard-block på egress-träff, routas till människa. Falska positiva accepteras._

### B8 — Beräkningsmotor-gränser för Construction (S6) och Trades (S7)

**Fråga:** Vad räknar BoQ-motorn (Construction) och tim-/material-motorn (Trades) automatiskt, och vad lämnar de till säljaren att fylla i manuellt? Solar-ROI är tydligt avgränsad; entreprenad och hantverk har mer judgment-mängder.

**Rekommendation:** Skjut det detaljerade beslutet till start av S6 respektive S7. Idag räcker det att fastställa principen: **motorerna räknar deterministiskt på *strukturerade* indata** (mängdförteckning för bygg, timupplägg för hantverk) — AI:n hjälper säljaren att fylla i den strukturen från KB, men friform-text översätts aldrig direkt till siffror utan att passera strukturen. Detaljerna landas i ADR 0002+ när vi närmar oss respektive fas.

**Status:** _Deferred to S6/S7_

### B9 — Delad produktkatalog vs per-vertikal (blockerar S1)

**Fråga:** Ska `quoting_products` vara en universell tabell taggad med vilka vertikaler en produkt tillhör, eller separata `solar_products` / `construction_products` / `trades_products`?

**Rekommendation:** **En `quoting_products`-tabell med `verticals jsonb $type<string[]>`** (matchar §6.2). Skäl: (1) många produkter passerar gränser — en kabel kan vara både solar och bygg, (2) sökning/listor över hela katalogen blir trivial, (3) en kostnads-kolumn (intern) hör hemma per produkt, inte tre gånger. Per-vertikal-tabeller introducerar duplikat utan vinst.

**Status:** _Decided 2026-05-28: **Per rekommendation** — en universell `quoting_products` med `verticals jsonb $type<string[]>`-taggning._

---

## När alla `Status` är `Decided`

Säg till mig — då uppdaterar jag `docs/architecture/quoting-platform-architecture.md` §21 så Open decisions reflekterar verkligheten, och vi startar Fas S0 enligt task-packet i `docs/architecture/tasks/phase-s0.md`.
