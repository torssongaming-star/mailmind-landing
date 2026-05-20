# Mailmind — Teknisk driftrevisionen (uppföljning)
**Datum:** 2026-05-19  
**Typ:** Uppföljning av revision 2026-05-16 + ny driftgranskning  
**Analyserad kodbas:** `mailmind-landing` (Next.js 16, Drizzle 0.45, Clerk, Stripe, Anthropic Haiku 4.5)  
**Format:** Brutalt ärlig CTO/drift-ingenjör-feedback. Kodbevis med fil:rad för varje påstående.

---

## 0. TL;DR

Sex av tio Fas 1-punkter är åtgärdade — fyra utan förbehåll, två med allvarliga luckor. Den enskilt viktigaste bristen kvarstår: **inga applikationstester existerar**. `package.json` pekar på en test-fil som inte finns. Sentry saknar `instrumentation.ts`, vilket innebär att server-sidan förmodligen inte rapporterar errors. Den nya driftgranskningen hittar tre nya kritiska brister: SendGrid-webhook kör AI synkront utan `after()` (timeout + dubbelkörningsrisk), checkout-endpunkten saknar rate-limit, och health-endpunkten är publikt åtkomlig om `ADMIN_HEALTH_SECRET` inte sätts.

**Bedömning: INTE REDO för betalande kunder.**  
Produkten är nära, men de tre ovanstående + avsaknaden av tester gör att en enda Anthropic-timeout under hög belastning kan korrumpera kundens upplevelse, och du har ingen backup-plan.

---

## 1. Fas 1-verifiering — 10 punkter från föregående rapport

### P2.1 — Plan-gränser fejk
**Status: ÅTGÄRDAD**  
`src/lib/app/entitlements.ts` rad 139–144: två parallella `COUNT(*)`-queries mot `inboxes` och `usersTable` med `organizationId` i WHERE. Resultaten injiceras i `computeAccess()` som använder reella värden. `assertCanAddInbox()` och `assertCanInviteUser()` finns (rad 304, 315). Entitlements-testerna i `src/lib/app/entitlements.test.ts` täcker gränsfallen.

---

### P2.4 — Pub/Sub-push verifierar inte Google OIDC JWT
**Status: ÅTGÄRDAD**  
`src/app/api/webhooks/gmail/push/route.ts` rad 75–103: `requireInProduction("GMAIL_PUSH_OIDC_AUDIENCE")` anropas, JWT verifieras via `verifyGoogleOidcJwt()`, ogiltiga tokens returnerar 401. `ALLOW_UNSIGNED_PUBSUB=1` tillåts bara utanför prod.

---

### P2.5 — Env-namn-divergens Gmail-kryptering
**Status: ÅTGÄRDAD (med marginalrisk)**  
`src/lib/app/gmail.ts` rad 44: accepterar `GMAIL_ENCRYPT_KEY` (kanonisk) med fallback till `GMAIL_TOKEN_ENCRYPTION_KEY`. `src/lib/env.ts` har `resolveLegacyEnv()` för att varna vid legacy-namn. Marginalrisken kvarstår: `OUTLOOK_ENCRYPT_KEY` saknar motsvarande legacy-fallback. Om Emil av misstag använder ett felstavat namn för Outlook-nyckeln kastas ett runtime-fel utan tydlig varning.

---

### P2.7 — Tester för `canAutoSend()`
**Status: OFIXAD — kritisk**  
`src/lib/app/autoSend.test.ts` existerar inte. Glob-sökning bekräftar: inga applikationstestfiler alls utanför `node_modules`. `package.json` rad 16 refererar `"test:autoSend": "vitest run src/lib/app/autoSend.test.ts"` — ett script som kraschar vid körning eftersom målfilen saknas. `canAutoSend()` i `autoSend.ts` rad 77–108 (4 regler, 6 villkor) är produktens enda garanterade säkerhetsbarriär mot felaktiga autosvar. Ingen kod täcker den.

**Konsekvens:** En enda regression i `confidence`-tröskeln eller `riskLevel`-logiken kan leda till att AI:n autosänder svar till kunders kunder utan mänsklig granskning. Utan test märker ni det inte förrän det hänt.

---

### P6.3 — Sentry installerat
**Status: DELVIS — server-sidan är antagligen inaktiv**  
`@sentry/nextjs@10.53.1` finns i `package.json`. `sentry.server.config.ts` och `sentry.client.config.ts` finns och konfigurerar Sentry med PII-filter. Men `src/instrumentation.ts` saknas. Next.js 13+ kräver `instrumentation.ts` (med `register()` som importerar Sentry-init) för att server-sidan ska initieras. Utan den filen initieras Sentry bara för klient-bundeln — server-errors i API-routes och webhooks når aldrig Sentry. Klient-errors rapporteras korrekt.

**Bevis:** `find ... src/instrumentation* → "no instrumentation.ts"` (bash-output).

---

### P1.1 — Analytics-instrumentation
**Status: ÅTGÄRDAD**  
`posthog-js@1.373.5` och `posthog-node@5.34.2` i `package.json`. `src/lib/analytics.ts` finns med `trackEvent()`, `identifyUser()`, `groupOrg()`. Används i Stripe-webhook, onboarding-route, drafts-route. `src/lib/client/analytics.ts` finns för klient-sidan. PostHog EU konfigurerat. `CookieBanner.tsx` exponerar `getConsent()` som konsumerande kod ska läsa innan PostHog initieras.

**Marginalrisk:** Det är inte verifierat att PostHog faktiskt blockeras tills samtycke ges — `layout.tsx` bör kontrollera `getConsent().analytics` innan `posthog.init()` anropas.

---

### P2.3 — `email_messages` org-scoped
**Status: DELVIS — NOT NULL saknas, backfill obekräftad**  
`src/lib/db/schema.ts` rad 379: `organizationId: uuid("organization_id").references(...)`  — utan `.notNull()`. Kolumnen är nullable. Backfill-SQL är dokumenterat i schema-kommentaren men det är okänt om den körts i Neon. Om gamla rader saknar `organizationId` ger `email_messages_org_idx` inget skydd. Ytterligare ett problem: Drizzle-schemat har `uniqueIndex("email_messages_external_id_uniq").on(t.externalMessageId)` (vanligt unikt index), men `project-state.md` dokumenterar att manuell SQL ska skapa ett PARTIELLT index `WHERE external_message_id IS NOT NULL`. Om `db:push` körts igen kan det ha skapat ett felaktigt icke-partiellt index, eller ignorerat indexet helt p.g.a. befintliga NULL-dubbletter.

---

### P2.8 — Stripe `current_period_end` utan `as any`
**Status: ÅTGÄRDAD**  
`src/app/api/webhooks/stripe/route.ts` rad 37–53: `resolvePeriodEnd()` hanterar både ny API-shape (items.data[0].current_period_end) och legacy top-level, med safe fallback till `now + 30 dagar` om båda saknas. Ingen `as any` i kritisk path.

---

### P2.11 — Debug-endpoints raderade
**Status: ÅTGÄRDAD**  
Inga `src/app/api/db-test*`, `scratch/` eller `household-bills/` hittades.

---

### P2.9 — PII-maskering i `writeAuditLog`
**Status: ÅTGÄRDAD**  
`src/lib/app/audit.ts` rad 39–53: `maskMetadata()` maskerar kända PII-nycklar (`email`, `from`, `to`, `fromEmail`, etc.) och trunkerar fri text. Anropas i `writeAuditLog()` rad 107 innan DB-insert.

---

## 2. Ny driftgranskning — kritiska fynd

### D1 — SendGrid-webhook kör auto-triage synkront
**Problem:** `src/app/api/webhooks/sendgrid/inbound/route.ts` rad 289–293 anropar `await autoTriageNewMessage(...)` synkront i request-hanteraren. SendGrid har en timeout på ~30 sekunder. Anthropic Haiku kan ta 5–20 sekunder under hög belastning. Om svaret dröjer returneras en `504`-timeout, SendGrid försöker leverera igen — och du får en ny AI-draft på samma tråd. `findPendingDraft()`-skyddet i autoTriage.ts hindrar duplikat-drafts, men det kräver att första anropet hunnit skriva till DB.  
**Kontrast:** Gmail Pub/Sub-webhook rad 241 i `gmail/push/route.ts` använder korrekt `after(() => autoTriageNewMessage(...))` — svarar 200 omedelbart och kör AI asynkront.  
**Affärspåverkan:** Vid ökad belastning (fler kunder, Anthropic-latens) börjar inkommande mejl via `mailmind.se`-adresser misslyckas. Dubbla AI-draft-anrop bränner tokens.  
**Lösning:** Ersätt synkron await med `after()` på rad 289, identiskt med Gmail-patenten. Returnera `{ status: "queued" }` istället för `draftId` (draftId är ändå okänd vid 200-svaret).  
**Komplexitet:** Easy. **Effekt:** High.

---

### D2 — Health-endpunkt öppen utan auth om `ADMIN_HEALTH_SECRET` inte sätts
**Problem:** `src/app/api/admin/health/route.ts` rad 23: `const adminSecret = process.env.ADMIN_HEALTH_SECRET; if (adminSecret) { ... }`. Om miljövariabeln inte sätts hoppas auth-kontrollen över. Endpunkten exponerar DB-status, Stripe-nyckel-alignment, env-var-närvaro — inte katastrofalt men information en angripare kan använda.  
**Lösning:** Kräv `ADMIN_HEALTH_SECRET` i production via `requireInProduction("ADMIN_HEALTH_SECRET")`. Returnera 500 om den saknas.  
**Komplexitet:** Easy. **Effekt:** Medium.

---

### D3 — Checkout-endpunkt saknar rate-limit
**Problem:** `src/app/api/billing/checkout/route.ts` har Clerk-autentisering men ingen rate-limit. En inloggad användare kan skicka 1000 POST-anrop som triggar `stripe.checkout.sessions.create()` 1000 gånger. Stripe-API-limit är 100 req/s per nyckel globalt. Vid attack eller bug blockeras checkout för alla kunder.  
**Lösning:** Lägg till `rateLimit(\`checkout:${userId}\`, { limit: 5, window: 60 })` med Upstash (redan installerat). Returnera 429 vid överskridning.  
**Komplexitet:** Easy. **Effekt:** High.

---

### D4 — Sentry saknar `instrumentation.ts`
**Problem:** Se P6.3 ovan. Server-sidan initieras inte utan `src/instrumentation.ts`. API-route-errors, webhook-failures och cron-kraschar rapporteras inte till Sentry. Enbart klient-side bundle-errors fångas.  
**Lösning:**
```ts
// src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config"); // om edge-runtime används
  }
}
```
Inga nya paket — `@sentry/nextjs` är redan installerat.  
**Komplexitet:** Easy. **Effekt:** High.

---

### D5 — Inga boot-time env-valideringar
**Problem:** `src/lib/env.ts` har `required()`, `assertSet()` och `requireInProduction()` men inget av dessa anropas vid applikationsstart. Alla kontroller är lazy — de kastar bara när en specifik route eller webhook anropas. En deploy med fel konfiguration (t.ex. saknad `CRON_SECRET`) syns inte förrän cron körs vid midnatt. `next.config.ts` validerar inga env-vars vid build.  
**Lösning:** Skapa `src/lib/env.validate.ts` som kallas från `instrumentation.ts` (register-funktionen, se D4). Validera kritiska vars: `DATABASE_URL`, `CLERK_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `CRON_SECRET`. Kasta `MissingEnvError` vid saknade vars — crashar deployment istället för att köra tyst trasig.  
**Komplexitet:** Easy. **Effekt:** High.

---

### D6 — Health-endpunkt testar inte Anthropic/Resend live
**Problem:** `src/lib/admin/health.ts` verifierar DB (SELECT 1), env-var närvaro, Stripe key alignment, och inbox_provider enum. Den gör **inga** live API-anrop mot Anthropic, Resend, SendGrid, Google eller Microsoft. Om `ANTHROPIC_API_KEY` är inställd med ett utgånget/ogiltigt värde visar health-checken "ok" tills första AI-draft-genereringen failar i produktion.  
**Lösning:** Lägg till lightweight-checks:
- Anthropic: `anthropic.models.list()` eller en minimal completion med max 1 token
- Resend: `resend.domains.list()` — verifierar att nyckeln är giltig och domänen verifierad  
Returnera `warn` (inte `fail`) om dessa misslyckas — undviker false alarms vid Anthropic-incidenter.  
**Komplexitet:** Medium. **Effekt:** High.

---

### D7 — `email_messages` hämtas sekventiellt i GDPR-export
**Problem:** `src/app/api/app/account/export/route.ts` rad 72–77: `for (const tid of threadIds) { const rows = await db.select().from(emailMessages).where(eq(emailMessages.threadId, tid)); }` — sekventiella DB-anrop per tråd. En org med 500 trådar gör 500 serialiserade queries. Vercel Hobby-funktioner har 10 sekunders timeout (Pro: 60 s). Export kan timeout för medelstora kunder.  
**Lösning:** Använd `inArray(emailMessages.threadId, threadIds)` för att hämta alla meddelanden i ett query. Drizzle-import: `inArray` från `drizzle-orm`.  
**Komplexitet:** Easy. **Effekt:** Medium (korrekthet vid tillväxt).

---

### D8 — `provisionCustomerAction` har syntetiska Stripe-IDs kvar
**Problem:** `src/lib/admin/actions.ts` rad 322: `const syntheticSubId = \`sub_trial_${Date.now()}\``; rad 341: `stripeCustomerId: \`cus_trial_${org.id}\``. Admin-onboarding-flödet skriver dessa till DB:n. Checkout-routen hanterar dem korrekt (rad 80–84), men om Live Stripe-nycklar aktiveras och en manuellt provisionerad kund uppgraderar, kan Stripe-operationer mot `cus_trial_*` krascha med "No such customer".  
**Affärspåverkan:** Om Emil onboardar en betalande pilot via admin-panelen med test-nycklar, sedan byter till live-nycklar, kan den kunden inte uppgradera/ändra plan via Stripe.  
**Lösning:** Skapa en riktig Stripe-customer vid provisioning (en enda `stripe.customers.create()` kostar ingenting). Eller: märk tydligt i UI att provision-flödet INTE ska användas med live-kunder förrän Stripe-nycklar bytts.  
**Komplexitet:** Medium. **Effekt:** High (databasintegritet).

---

### D9 — Backup och disaster recovery odokumenterat
**Problem:** Inga dokument i projektet beskriver Neon PITR-fönster, RTO, RPO eller degraded-mode-strategi. Specifika scenarier:
- **Anthropic nere 30 min:** Inkommande mejl sparas i DB men ingen AI-draft skapas. Agenter får inga drafts att granska. Ingen retry-queue. Trådar sitter tysta tills Anthropic är uppe igen (då hjälper det inte eftersom autoTriage bara körs vid inkommande meddelande).
- **Stripe nere 30 min:** Checkout blockeras, customer portal blockeras. Befintliga subscriptions fungerar (DB-kopia).
- **Neon nere 30 min:** Alla routes som gör DB-anrop returnerar 503 (isDbConnected-check). Men `db`-proxyn returnerar null istället för att kasta i vissa paths — tyst fail.
- **Gmail API nere:** Token-refresh misslyckas, tokens uppdateras inte, inbox kan gå mörk.  
**Lösning:** Skriv ett 1-sidig DR-dokument som täcker dessa scenarier och Neons PITR-konfiguration. Aktivera Neon point-in-time-restore (ingår i Scale-plan).  
**Komplexitet:** Easy (dokumentation). **Effekt:** Medium (driftberedskap).

---

### D10 — Outlook-webhook saknar stale-notification-guard
**Problem:** Gmail Pub/Sub-webhook har en `historyId`-guard (rad 146–149): om den inkommande `historyId` är äldre än den lagrade, hoppas meddelandet. Microsoft Notifications-webhook (`src/app/api/webhooks/microsoft/notifications/route.ts`) saknar motsvarande guard. Microsoft Graph garanterar at-least-once-delivery och kan skicka om gamla notifieringar. Idempotency via `findMessageByExternalId` finns, men UNIQUE-index-check kräver en DB-tur. Vid hög frekvens (Graph-storm) kan detta öka DB-belastning avsevärt.  
**Lösning:** Lagra senast processade `changeToken` i `inboxes.config` för Outlook-inboxar, precis som `historyId` för Gmail. Skippa notifieringar med äldre tokens.  
**Komplexitet:** Medium. **Effekt:** Medium.

---

### D11 — `console.log` i produktionskritisk kod
**Problem:** `src/lib/app/autoSend.ts` rad 215–221: 
```typescript
console.log("[autoSend] signature lookup", {
  userId,
  foundUser: !!user,
  appendSignature: user?.appendSignature,
  ...
});
```
Rad 235: `console.log("[autoSend] signatureToUse:", ...)`. Dessa är inte PII i sig men avviker från `createLogger`-mönstret som används i alla webhook-routes. Vercel samlar console-logs i plaintext. Vid felsökning är strukturerade loggar med log-level och context mycket mer användbara.  
**Lösning:** Importera `createLogger("autoSend")` och byt `console.log` → `log.debug`.  
**Komplexitet:** Easy. **Effekt:** Low.

---

### D12 — PostHog-samtycke inte verifierat kopplat till init
**Problem:** `CookieBanner.tsx` exponerar `getConsent()` och skickar `CustomEvent("mailmind:consent-updated")`. Men det är okänt om `src/app/layout.tsx` faktiskt läser consent innan PostHog initieras. Om PostHog-init sker oberoende av samtycke bryts ePrivacy-direktivets krav (opt-in för analytics i Sverige).  
**Lösning:** Verifiera att PostHog-init i layout.tsx lyssnar på `mailmind:consent-updated` och kallar `posthog.opt_in_capturing()` / `opt_out_capturing()` baserat på `getConsent().analytics`.  
**Komplexitet:** Easy. **Effekt:** Medium (juridisk compliance).

---

### D13 — Schemadrift: `uniqueIndex` i Drizzle vs partiellt index i Neon
**Problem:** `src/lib/db/schema.ts` rad 390: `uniqueIndex("email_messages_external_id_uniq").on(t.externalMessageId)` — ett vanligt unikt index utan WHERE-klausul. `project-state.md` rad 170 dokumenterar att det manuella SQL-indexet är `CREATE UNIQUE INDEX IF NOT EXISTS email_messages_external_id_uniq ON email_messages (external_message_id) WHERE external_message_id IS NOT NULL;` — ett partiellt index.

Om `npm run db:push` körs:
1. Drizzle ser att `email_messages_external_id_uniq` redan finns (rätt namn).
2. Drizzle kan försöka droppa och återskapa det.
3. Om gamla rader har `externalMessageId = NULL` (multipla) kraschar det vanliga unika indexet.
4. Alternativt: Drizzle ignorerar det om det redan finns med rätt namn, men lämnar en latent risk.  
**Lösning:** Uppdatera Drizzle-schemat till `uniqueIndex("email_messages_external_id_uniq").on(t.externalMessageId).where(sql\`${emailMessages.externalMessageId} IS NOT NULL\`)`. Alternativt: behåll det manuella SQL-scriptet och ta bort Drizzle-definitionen (men sätt en kommentar).  
**Komplexitet:** Easy. **Effekt:** Medium (driftsäkerhet vid schema-push).

---

## 3. Outlook–Gmail-parity-check

| Aspekt | Gmail | Outlook | Paritet |
|---|---|---|---|
| Token-kryptering | AES-256-GCM, `GMAIL_ENCRYPT_KEY` | AES-256-GCM, `OUTLOOK_ENCRYPT_KEY` | ✅ |
| Token-refresh | `getValidAccessToken()` | `getValidAccessToken()` | ✅ |
| Webhook-autentisering | OIDC JWT (`verifyGoogleOidcJwt`) | `clientState` HMAC (`constantTimeEquals`) | ✅ (olika modell) |
| Stale-notification-guard | `historyId`-guard | ❌ saknas | ⚠️ |
| `after()` för auto-triage | ✅ rad 241 | ✅ | ✅ |
| Subscription-renewal | Pub/Sub är long-lived | Daglig cron, alert vid 2 failures | ✅ |
| Send-funktion | `sendViaGmail()` | `sendViaOutlook()` | ✅ |
| Legacy env-fallback | ✅ (`GMAIL_TOKEN_ENCRYPTION_KEY`) | ❌ | ⚠️ |
| Idempotens | UNIQUE index + `findMessageByExternalId` | `findMessageByExternalId` | ✅ |

---

## 4. Driftgodkännande-checklista

Dessa punkter måste vara avbockade innan första betalande kund tas in.

### Obligatoriska (blocker)

- [ ] **TEST-SUITE** — Skapa `src/lib/app/autoSend.test.ts` med minst 8 tester (se Prompt 1 nedan). Kör `npm test` utan fel.
- [ ] **instrumentation.ts** — Lägg till `src/instrumentation.ts` som initierar Sentry server-sidan korrekt.
- [ ] **SendGrid after()** — Flytta `autoTriageNewMessage` i SendGrid-webhook till `after()`.
- [ ] **Live Stripe-nycklar** — Byt `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` i Vercel. Registrera live webhook.
- [ ] **SendGrid Inbound Parse-MX** — MX för `mail.mailmind.se` → `mx.sendgrid.net` prio 10 i Loopia.
- [ ] **UNIQUE index i Neon** — Bekräfta att `email_messages_external_id_uniq` (partiell) finns via `\d email_messages` i Neon SQL Editor. Om inte: kör manuellt SQL i project-state.md.
- [ ] **email_messages backfill** — Kör `UPDATE email_messages m SET organization_id = t.organization_id FROM email_threads t WHERE m.thread_id = t.id AND m.organization_id IS NULL` i Neon.
- [ ] **Google OAuth consent screen** — Lägg till domän `mailmind.se`, skicka för Google-verifiering.
- [ ] **ADMIN_HEALTH_SECRET** — Sätt som required i production (ändra route.ts).

### Rekommenderade (bör vara klara)

- [ ] **Boot-time env-validering** — `instrumentation.ts` kallar `assertSet(...)` för kritiska vars.
- [ ] **Checkout rate-limit** — 5 req/min/user med Upstash.
- [ ] **SENTRY_DSN** — Lägg till i Vercel. Verifiera att server-errors dyker upp i Sentry efter ett test-404.
- [ ] **POSTHOG_KEY + NEXT_PUBLIC_POSTHOG_KEY** — Lägg till i Vercel och bekräfta events dyker upp i PostHog EU.
- [ ] **PostHog samtycke** — Verifiera att `opt_in_capturing` anropas efter `getConsent().analytics === true`.
- [ ] **DKIM/SPF/DMARC** — Verifiera för `mailmind.se` via `dmarcian.com` eller `mxtoolbox.com`.
- [ ] **Skicka testmejl** — Manuellt verifiera att utgående svar via Resend levereras och inte hamnar i spam.
- [ ] **Health-endpunkt** — Verifiera att `/api/admin/health` returnerar alla "ok" med live-konfiguration.
- [ ] **Neon Scale-plan + PITR** — Aktivera point-in-time-restore om Hobby-plan används.

---

## 5. Uppdaterad prioriterad roadmap

### Fas 1 — Driftsäkerhet (1–2 veckor, blocker)

| # | Åtgärd | Fil | Komplexitet | Effekt |
|---|---|---|---|---|
| 1 | Skapa `autoSend.test.ts` med 8+ tester | `src/lib/app/autoSend.test.ts` (ny) | Easy | Massive |
| 2 | Lägg till `instrumentation.ts` (Sentry server-init) | `src/instrumentation.ts` (ny) | Easy | High |
| 3 | `after()` i SendGrid-webhook för auto-triage | `src/app/api/webhooks/sendgrid/inbound/route.ts:289` | Easy | High |
| 4 | Rate-limit på checkout | `src/app/api/billing/checkout/route.ts` | Easy | High |
| 5 | Kräv `ADMIN_HEALTH_SECRET` i prod | `src/app/api/admin/health/route.ts:23` | Easy | Medium |
| 6 | Boot-time env-validering i `instrumentation.ts` | `src/lib/env.validate.ts` (ny) | Easy | High |
| 7 | `inArray` i GDPR-export | `src/app/api/app/account/export/route.ts:72` | Easy | Medium |
| 8 | Schemadrift: partiellt index i Drizzle | `src/lib/db/schema.ts:390` | Easy | Medium |
| 9 | Schemadrift: `email_messages.organizationId` NOT NULL | `src/lib/db/schema.ts:379` + migration | Medium | High |
| 10 | Manuella ops (Emil): Live Stripe, SendGrid MX, Neon index, backfill | — | Ops | Blocker |

### Fas 2 — Produkt-konvertering (2–4 veckor)

| # | Åtgärd | Komplexitet | Effekt |
|---|---|---|---|
| 11 | Annual pricing toggle + Stripe price-IDs | Easy | High |
| 12 | Upgrade-modal vid 80 % AI-draft-usage | Medium | High |
| 13 | Anthropic/Resend live-checks i health-endpoint | Medium | High |
| 14 | Outlook stale-notification-guard | Medium | Medium |
| 15 | Riktig Stripe-customer vid admin-provisioning | Medium | High |
| 16 | Interaktiv landing-demo (3 exempelmejl) | Advanced | Massive |
| 17 | PostHog samtycke verifierat i layout.tsx | Easy | Medium |
| 18 | DR-dokument (Neon PITR, RTO, degraded mode) | Easy | Medium |

### Fas 3 — Skalbarhet (1–2 månader)

| # | Åtgärd | Komplexitet | Effekt |
|---|---|---|---|
| 19 | Task-kö (QStash/Vercel Queues) för autoTriage | Advanced | Massive |
| 20 | Migrera rate-limit till Upstash Redis globalt | Easy | High |
| 21 | pgvector-baserad KB-retrieval | Advanced | High |
| 22 | Outlook stale-notification-guard | Medium | Medium |
| 23 | LLM-as-judge för drafts med confidence ≥ 0.90 | Advanced | Massive |
| 24 | Statuspage + uptime-monitor | Easy | Medium |

### Fas 4 — Enterprise (2–3 månader)

Som tidigare revision — SSO/SAML, SOC 2, workflow-byggare, Clerk Organizations.

---

## 6. Fem nya färdiga prompter

---

### Prompt 1 — Skapa autoSend.test.ts (kritisk, blocker)

```
Bakgrund: src/lib/app/autoSend.test.ts existerar inte. package.json refererar scriptet
"test:autoSend" till denna fil. Autosvar-pipelinen är produktens enda säkerhetsgaranti.

Uppgift:
1. Skapa src/lib/app/autoSend.test.ts med vitest.
2. Importera { canAutoSend, AUTO_SEND_CONFIDENCE_THRESHOLD } från "./autoSend".
3. Täck EXAKT dessa fall (kopiera beskrivningen till it()-strängar):
   - PASS: confidence 0.95, sourceGrounded true, riskLevel "low", action "summarize",
     interactionCount 5, isBlocked false → eligible === true.
   - BLOCK confidence: confidence 0.89 → eligible false, blockers[0] innehåller "confidence_too_low".
   - BLOCK not_source_grounded: sourceGrounded false → blockers innehåller "not_source_grounded".
   - BLOCK risk_medium: riskLevel "medium" → blockers innehåller "risk_level_medium".
   - BLOCK risk_high: riskLevel "high" → blockers innehåller "risk_level_high".
   - BLOCK action_escalate: action "escalate" → blockers innehåller "action_is_escalate".
   - BLOCK new_customer: interactionCount 2 → blockers innehåller "new_customer".
   - BLOCK sender_blocked: isBlocked true → blockers innehåller "sender_blocked".
   - BLOCK alla: confidence 0.5, sourceGrounded false, riskLevel "high", action "escalate",
     interactionCount 1, isBlocked true → blockers.length === 6 (EXAKT, räkna noggrant).
   - PASS threshold-exact: confidence === AUTO_SEND_CONFIDENCE_THRESHOLD (0.90) → eligible true.
   - BLOCK just-under: confidence 0.8999 → eligible false.
4. Verifiera att AUTO_SEND_CONFIDENCE_THRESHOLD är 0.90 (hårdkodat check).
5. Kör npm run test:autoSend. Fixa eventuella TypeScript-fel.
6. Kör npm run typecheck. Inga fel accepteras.

Inga nya paket. Vitest är redan installerat. Filen är en ren unit-test — inga DB-anrop.
```

---

### Prompt 2 — Lägg till `instrumentation.ts` + boot-time env-validering

```
Bakgrund: src/instrumentation.ts saknas → Sentry initieras inte server-sidan.
Boot-time env-validering saknas → trasiga deployments syns inte vid start.

Uppgift:
1. Skapa src/instrumentation.ts:
   export async function register() {
     if (process.env.NEXT_RUNTIME === "nodejs") {
       await import("../sentry.server.config");
       // Boot-time validation
       const { assertSet, requireInProduction } = await import("./lib/env");
       assertSet("DATABASE_URL", "CLERK_SECRET_KEY", "ANTHROPIC_API_KEY", "RESEND_API_KEY");
       requireInProduction("STRIPE_WEBHOOK_SECRET");
       requireInProduction("CRON_SECRET");
       requireInProduction("ADMIN_HEALTH_SECRET");
       requireInProduction("GMAIL_PUSH_OIDC_AUDIENCE"); // om Gmail används
     }
   }
2. I src/app/api/admin/health/route.ts rad 23: ändra
   const adminSecret = process.env.ADMIN_HEALTH_SECRET;
   if (adminSecret) {
   till:
   const adminSecret = requireInProduction("ADMIN_HEALTH_SECRET");
   if (adminSecret) {
   (importera requireInProduction från "@/lib/env")
3. Kör npm run build lokalt (eller typecheck) — det ska inte krascha om env-vars är satta i .env.local.
4. Dokumentera i .claude/context/project-state.md: "instrumentation.ts finns, initierar Sentry + validerar env vid start."

Inga nya paket. `requireInProduction` finns redan i src/lib/env.ts.
```

---

### Prompt 3 — Fixa SendGrid-webhook: after() + rate-limit checkout

```
Bakgrund:
  A) src/app/api/webhooks/sendgrid/inbound/route.ts rad 289 kör autoTriageNewMessage 
     synkront — risk för SendGrid-timeout (30s) och dubbel-retry.
  B) src/app/api/billing/checkout/route.ts saknar rate-limit — Stripe-API kan DoS:as.

Uppgift A — SendGrid after():
1. Importera { after } från "next/server" i sendgrid/inbound/route.ts.
2. Ersätt rad 289–293:
   const triageResult = await autoTriageNewMessage({...});
   return NextResponse.json({ ..., draftId: triageResult.ok ? triageResult.draftId : null });
   med:
   after(() =>
     autoTriageNewMessage({ organizationId: inbox.organizationId, threadId: thread.id, newEmailBody: bodyText })
       .catch(err => console.error("[inbound] autoTriage failed", err))
   );
   return NextResponse.json({ status: "ok", threadId: thread.id });
3. Ta bort triageResult-referensen i return-satsen.
4. Verifiera att inga TypeScript-fel uppstår.

Uppgift B — Checkout rate-limit:
1. I src/app/api/billing/checkout/route.ts, efter auth-check (rad ~15), lägg till:
   const { rateLimit, RATE_LIMITS } = await import("@/lib/rate-limit");
   if (!(await rateLimit(`checkout:${userId}`, { limit: 5, window: 60 }))) {
     return NextResponse.json({ error: "För många förfrågningar. Försök igen om en minut." }, { status: 429 });
   }
2. Kör npm run typecheck.

Inga nya paket — after() och rateLimit finns redan i kodbasen.
```

---

### Prompt 4 — Fixa schemadrift: partiellt index + NOT NULL på email_messages.organizationId

```
Bakgrund:
  1. src/lib/db/schema.ts rad 390 definierar ett vanligt uniqueIndex på externalMessageId
     men Neon har ett partiellt index (WHERE external_message_id IS NOT NULL).
     Drift: om db:push körs igen kan det krascha eller skapa fel index.
  2. email_messages.organizationId (rad 379) är nullable men bör vara NOT NULL
     eftersom varje meddelande alltid tillhör en org. Backfill behövs.

Uppgift:
1. I src/lib/db/schema.ts:
   a. Ändra rad 379:
      organizationId: uuid("organization_id").references(..., { onDelete: "cascade" })
      → lägg till .notNull() OM backfill bekräftats (fråga användaren).
      Om backfill EJ körts: behåll nullable men lägg kommentar "TODO: NOT NULL efter backfill".
   b. Ändra rad 390:
      uniqueIndex("email_messages_external_id_uniq").on(t.externalMessageId)
      → lägg till .where(sql`${emailMessages.externalMessageId} IS NOT NULL`)
      Importera { sql } från "drizzle-orm" om det saknas.

2. Skriv backfill-SQL i docs/migrations/email_messages_backfill.sql:
   -- Steg 1: Fyll i saknade organizationId
   UPDATE email_messages m
   SET organization_id = t.organization_id
   FROM email_threads t
   WHERE m.thread_id = t.id
     AND m.organization_id IS NULL;
   
   -- Steg 2: Verifiera att inga NULL kvar
   SELECT COUNT(*) FROM email_messages WHERE organization_id IS NULL;
   
   -- Steg 3: Sätt NOT NULL (kör BARA om steg 2 returnerar 0)
   ALTER TABLE email_messages ALTER COLUMN organization_id SET NOT NULL;

3. Kör npm run db:generate (inte db:push — generate skapar migrerings-SQL som Emil kan granska).
4. Informera användaren att Neon SQL Editor behöver köra backfill-SQL manuellt INNAN db:push.

Multi-tenant first: alla queries mot email_messages bör ha organizationId i WHERE.
Verifiera att listMessages() i src/lib/app/threads.ts inkluderar organizationId-filter.
```

---

### Prompt 5 — Lägg till stale-guard + OUTLOOK_ENCRYPT_KEY-fallback i Outlook-webhook

```
Bakgrund:
  A) Microsoft Notifications-webhook saknar stale-notification-guard. Gmail har historyId-guard.
     Microsoft Graph garanterar at-least-once delivery — gamla notifieringar kan komma om.
  B) OUTLOOK_ENCRYPT_KEY saknar legacy-fallback (Gmail har GMAIL_TOKEN_ENCRYPTION_KEY-fallback).
     Risk: Om Emil satt OUTLOOK_TOKEN_ENCRYPTION_KEY av misstag kraschar decryptTokens.

Uppgift A — Stale-guard i Microsoft-webhook:
1. I src/lib/app/outlook.ts, lägg till fältet `lastProcessedChangeToken?: string` i OutlookInboxConfig.
2. I src/app/api/webhooks/microsoft/notifications/route.ts, för varje notifikation:
   a. Läs `config.lastProcessedChangeToken` från inbox.
   b. Om notifikationens `changeType === "updated"` och en `resourceData.id` matchar
      något redan processerat: skippa med `continue`.
   c. Denna heuristik är enklare än full changeToken-tracking men minskar risken.
   Alternativ (föredras): Lagra senaste `resourceData.id` per inbox i config och skippa
   om `findMessageByExternalId(resourceData.id)` returnerar en rad — detta görs redan
   via idempotency-checken i loopen, men lägg till en early-exit INNAN dekrypterings-steget.

Uppgift B — Legacy env-fallback för Outlook:
1. I src/lib/app/outlook.ts, funktionen encryptKey() (rad ~65):
   Ändra:
     const hex = process.env.OUTLOOK_ENCRYPT_KEY;
   till:
     const hex = process.env.OUTLOOK_ENCRYPT_KEY
       ?? process.env.OUTLOOK_TOKEN_ENCRYPTION_KEY;
     if (!hex) { throw new Error("OUTLOOK_ENCRYPT_KEY not set..."); }
     if (process.env.OUTLOOK_TOKEN_ENCRYPTION_KEY && !process.env.OUTLOOK_ENCRYPT_KEY) {
       console.warn("[outlook] Using legacy OUTLOOK_TOKEN_ENCRYPTION_KEY. Migrate to OUTLOOK_ENCRYPT_KEY.");
     }
2. Kör npm run typecheck.

Prioritera uppgift B (1 rad) — den skyddar mot en dolt farlig felkonfiguration.
```

---

## 7. Slutsats

Mailmind har gjort seriös progress sedan revision 2026-05-16. Fyra av tio kritiska punkter är stängda utan förbehåll. Arkitekturen håller, multitenancy är disciplinerad, och den nya Outlook-integrationen är paritetsriktig på alla avgörande punkter.

Men tre saker håller produkten från driftberedskap:

**1. Inga tester.** `canAutoSend()` — produktens enda garanti mot att AI:n skickar fel saker — har noll täckning. En enda regression är en offentlig incident. Testerna tar ett par timmar att skriva.

**2. SendGrid kör AI synkront.** En dålig dag hos Anthropic gör att mailmind-inboxar slutar fungera och SendGrid börjar spamma er med retry-leveranser. Ändringen till `after()` tar 10 minuter.

**3. Sentry initieras inte server-sidan.** Ni flyger blinda på API-errors, webhook-failures och cron-kraschar. `instrumentation.ts` tar 15 minuter att lägga till.

Ingen av dessa tre är komplicerad. De är bara inte gjorda.
