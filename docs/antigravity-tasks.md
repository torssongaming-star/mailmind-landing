# Antigravity tasks — Mailmind

> **Uppdaterad 2026-05-14.**
>
> Varje task är fristående och shippas som **en PR**. Faser är sekventiella — påbörja inte nästa fas förrän den förra är merged (om inget annat anges).
>
> **Innan du börjar — läs i denna ordning:**
> 1. `CLAUDE.md` — låsta beslut, arbetssätt
> 2. `.claude/context/project-state.md` — vad som är byggt, kvarvarande caveats
> 3. `README.md` — arkitektur, flöden, env vars
> 4. `package.json` — innan du föreslår nytt paket, motivera i commit
>
> **Spelregler:**
> - Multi-tenant first — varje query utan `organizationId` i WHERE är en säkerhetsbugg, avvisas i review.
> - Kodbasen vinner över dokument om de skiljer sig. Flagga drift i PR-beskrivningen.
> - Schema-ändringar: uppdatera `src/lib/db/schema.ts` och meddela Sebastian att köra `npm run db:push`. Enum-tillägg kräver rå SQL i Neon (`ALTER TYPE ... ADD VALUE` utanför transaktion).
> - `"use server"`-filer: bara `export async function` — inga exporterade konstanter.
> - Commit-meddelanden på engelska, conventional commits-stil (`feat:`, `fix:`, `chore:` etc).
> - Inga `.md`-filer om inte specifikt ombett.
> - Frågor → Sebastian (kodaren). Fastnat? Skriv i PR-beskrivningen vad du fastnade på och tagga honom.

---

## Status per fas

```
Fas 6e  ⏳  Manuella ops (Sebastian + Emil — ingen kod, se längst ner)
Fas 11  🔲  Petitesser & fixar          ← BÖRJA HÄR
Fas 12  🔲  Säkerhet & stabilitet
Fas 13  🔲  Microsoft 365 / Outlook OAuth
Fas 14  🔲  Veckovis e-postrapport
Fas 15  🔲  Team & roller
Fas 16  🔲  Kundhistorik & AI-kontext
Fas 17  🔲  Prissättning & konvertering
Fas 18  🔲  PWA & mobilnotiser
```

---

---

# Fas 11 — Petitesser & fixar

> Snabba, fristående fixes. Kan köras parallellt av flera personer. Ingen PR behöver vänta på en annan.

---

## 11.1 — Registrera usage-warning cron i Vercel

**Prio:** P0 — funktionen är byggd men körs aldrig  
**Estimat:** 5 min

**Problem:** `src/app/api/cron/usage-warning/route.ts` finns och är fullt implementerad men saknas i `vercel.json`. Det innebär att veckovisa 99%-varningar till kunder **aldrig skickas**.

**Filen att ändra:** `vercel.json`

**Lägg till i `crons`-arrayen:**
```json
{
  "path": "/api/cron/usage-warning",
  "schedule": "0 8 * * 1"
}
```
*(Måndagar 08:00 UTC)*

**Done när:**
- `vercel.json` har båda cron-jobs
- Vercel dashboard → Functions → Cron Jobs visar `usage-warning` i listan

---

## 11.2 — Byt ut alert() i DryRunToggle mot inline-fel

**Prio:** P1  
**Estimat:** 15 min

**Problem:** `src/app/(admin)/admin/organizations/[id]/DryRunToggle.tsx` rad ~26 använder `alert()` för att visa fel. Det är blockerande, ser amatörmässigt ut och fungerar inte i alla browsers.

**Fil:** `src/app/(admin)/admin/organizations/[id]/DryRunToggle.tsx`

**Att göra:**
1. Lägg till `const [error, setError] = useState<string | null>(null)` i komponenten
2. Ersätt `alert(...)` med `setError(...)`
3. Rendera felet under knappen: `{error && <p className="text-xs text-red-400 mt-1">{error}</p>}`
4. Nollställ `error` vid nästa klick

**Done när:**
- Fel visas som röd text under knappen, inga `alert()`-anrop kvar i komponenten

---

## 11.3 — Ta bort console.log med PII från produktion

**Prio:** P1 — GDPR-risk  
**Estimat:** 20 min

**Problem:** Flera API-routes loggar e-postadresser och historyId:n i produktion. Vercel samlar dessa loggar och de är sökbara.

**Filer med `console.log` som innehåller PII:**
- `src/app/api/webhooks/gmail/push/route.ts` — loggar e-postadresser + historyId
- `src/app/api/webhooks/clerk/route.ts` — loggar userId vid deletion
- `src/app/api/billing/checkout/route.ts` — loggar plan + priceId (inte PII men onödigt)

**Regel:** Ta bort `console.log`. Behåll `console.error` för riktiga fel — de behövs för felsökning. Döp om till `console.error` om det är ett felscenario, annars ta bort.

**Done när:**
- `grep -r "console.log" src/app/api/` returnerar tomt

---

## 11.4 — Översätt trial-banner och statusbadges till svenska

**Prio:** P1 — UX  
**Estimat:** 20 min

**Problem:** Resten av appen är på svenska men trial-bannern och prenumerationsstatus är på engelska.

**Fil 1:** `src/app/(portal)/app/page.tsx` — `TrialBanner`-komponenten

Ändra:
- `"Your trial ends today"` → `"Din provperiod slutar idag"`
- `"X days left in your free trial"` → `"X dagar kvar av din provperiod"`
- `"Upgrade to continue using Mailmind without interruption."` → `"Uppgradera för att fortsätta använda Mailmind utan avbrott."`
- `"Upgrade"` (knapp) → `"Uppgradera"`
- `"Trial ends ..."` → `"Provperioden slutar ..."`

**Fil 2:** `src/app/(portal)/app/page.tsx` — `StatusBadge`-komponenten

Ändra labels:
- `"Active"` → `"Aktiv"`
- `"Trial"` → `"Provperiod"`
- `"Past due"` → `"Förfallen"`
- `"Cancelled"` → `"Avslutad"`
- `"Incomplete"` → `"Ofullständig"`
- `"Paused"` → `"Pausad"`

**Fil 3:** `src/app/(portal)/app/page.tsx` — `AccessBanner`

Översätt alla `title`, `body`, och CTA-strängar till svenska.

**Done när:**
- Ingen engelska syns i portal-UI för svenska användare (billing-sidan undantagen — Stripe hanterar den)

---

## 11.5 — Koppla admin-dashboardens "Recent Activity" och "Failed Integrations"

**Prio:** P2  
**Estimat:** 45 min

**Problem:** `src/app/(admin)/admin/page.tsx` har två sektioner som visar platshållartext:
- "No recent administrative actions found."
- "All systems operational..."

Data finns i databasen men är inte kopplad till UI:t.

**Att bygga:**

*Recent Activity:*
1. Lägg till `getRecentAuditLogs(limit: 10)` i `src/lib/admin/queries.ts` — hämtar senaste rader från `audit_logs` oavsett org, med `organizationId`, `action`, `createdAt`, `actorId`
2. Anropa den i `admin/page.tsx` (server component)
3. Rendera som en enkel tabell: datum | org | händelse

*Failed Integrations:*
1. Lägg till `getInboxesWithRecentErrors()` i `src/lib/admin/queries.ts` — hämtar inkorgar vars senaste `webhook_deliveries` har `status: "failed"` (senaste 24h)
2. Rendera som lista: org | inbox-slug | senaste felmeddelande

**Done när:**
- Admin-sidan visar faktiska audit-logghändelser och eventuella inkorg-fel utan hårdkodad text

---

## 11.6 — Snooze-presets på trådsidan

**Prio:** P2  
**Estimat:** 30 min

**Problem:** Agenter måste välja exakt datum/tid för snooze. "Imorgon kl 08:00" tar för lång tid.

**Filer:**
- `src/app/(portal)/app/thread/[id]/SnoozeButton.tsx` — befintlig komponent
- `src/app/api/app/threads/[id]/snooze/route.ts` — endpoint klar, tar ISO-timestamp

**Att bygga:**
1. Lägg till en dropdown med presets (beräknas client-side, `Europe/Stockholm`):
   - **1 timme** → `now + 1h`
   - **3 timmar** → `now + 3h`
   - **Imorgon kl 08:00** → nästa dag 08:00 lokal tid
   - **Nästa måndag kl 08:00** → nästa måndag 08:00 lokal tid
   - **Anpassat…** → öppnar befintlig datetime-picker
2. Vid val: beräkna ISO-sträng, POST direkt till endpoint
3. Stäng dropdown automatiskt

**Done när:**
- Agent kan snooza "till imorgon kl 08" med 2 klick
- Anpassat-alternativet öppnar befintlig picker

---

## 11.7 — Stats: tidsperiod-toggle (7d / 14d / 30d / 90d)

**Prio:** P2  
**Estimat:** 30 min

**Problem:** `/app/stats` visar hårdkodat 14 dagar.

**Filer:**
- `src/app/(portal)/app/stats/page.tsx`
- `src/app/(portal)/app/stats/DailyThreadsChart.tsx`
- `src/lib/app/stats.ts` — `getThreadsPerDay(orgId, days)` tar redan ett `days`-argument

**Att bygga:**
1. Läs `?range=7d|14d|30d|90d` i page.tsx, default `14d`
2. Toggle-knappar ovanför chart
3. Vid 30d/90d: byt till `LineChart` i recharts (bars blir oläsliga)
4. `router.push` med ny query-param vid toggle

**Done när:**
- Alla 4 ranges renderar korrekt
- Refresh behåller valet

---

## 11.8 — Webhook delivery log: retention-cron

**Prio:** P2  
**Estimat:** 20 min

**Problem:** `webhook_deliveries` växer obegränsat. 100 mejl/dag × 3 webhooks = ~110 000 rader/år.

**Filer:**
- `src/lib/app/webhooks.ts`
- `vercel.json`

**Att bygga:**
1. Ny fil `src/app/api/cron/webhook-cleanup/route.ts`:
   - Skyddad av `CRON_SECRET`-header (samma mönster som `usage-warning`)
   - `DELETE FROM webhook_deliveries WHERE created_at < now() - interval '30 days'`
   - Returnera `{ ok: true, deleted: N }`
2. Lägg till i `vercel.json` crons: `"schedule": "0 3 * * *"` (03:00 UTC dagligen)

**Done när:**
- Cron-jobbet syns i Vercel dashboard
- Manuell `curl` till routen med rätt secret returnerar `{ ok: true, deleted: N }`

---

---

# Fas 12 — Säkerhet & stabilitet

---

## 12.1 — SendGrid webhook: HMAC-verifiering

**Prio:** P0 — säkerhetsgap  
**Estimat:** 45 min

**Problem:** `src/app/api/webhooks/sendgrid/inbound/route.ts` saknar signaturvalidering. Vem som helst som känner till URL:en kan POST:a fejkade mejl och trigga AI-pipeline för en godtycklig inkorg.

**Lösning:** SendGrid Inbound Parse stöder ett "signed webhook" med en ECDSA-signatur. Implementera verifiering:

1. Lägg till env var `SENDGRID_WEBHOOK_VERIFICATION_KEY` (public key från SendGrid dashboard → Settings → Mail Settings → Inbound Parse → Enable Signed Webhook)
2. I route-handlera: extrahera `X-Twilio-Email-Event-Webhook-Signature` och `X-Twilio-Email-Event-Webhook-Timestamp` från headers
3. Verifiera med SendGrids [Event Webhook Security](https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features) — Node.js-implementationen är ~15 rader
4. Om verifiering misslyckas: returnera `401`

**Alternativ (enklare):** Om SendGrid signed webhook är svårt att aktivera — lägg åtminstone till ett delat hemligt token i URL:en (`?secret=XXXX`) och jämför mot `SENDGRID_INBOUND_SECRET` env var.

**Done när:**
- POST till endpointen utan rätt signatur returnerar 401
- Legitima SendGrid-anrop passerar igenom

---

## 12.2 — AI-retry med exponential backoff

**Prio:** P1  
**Estimat:** 30 min

**Problem:** `client.messages.create()` i `src/lib/app/ai.ts` failar tyst vid 5xx/timeouts. Kunden får inget utkast utan att förstå varför.

**Filer:**
- `src/lib/app/ai.ts` — kolla om `retryWithBackoff` redan finns
- `src/lib/app/autoTriage.ts` — consumer
- `src/app/api/app/ai/draft/route.ts` — manuell consumer

**Att bygga:**
1. Implementera `retryWithBackoff<T>(fn, { maxRetries: 2, delays: [500, 1500] })` om den inte redan finns
2. Wrappa ALLA `client.messages.create()` anrop
3. Retrya endast på: `status >= 500`, `ETIMEDOUT`, `ECONNRESET` — INTE på `status === 400/401/429`
4. Vid 429 (rate limit): respektera `retry-after`-headern istället för fast delay
5. Vid slutgiltig miss: returnera `{ ok: false, reason: "ai_transient_error" }` — logga till audit_logs

**Done när:**
- Simulerad 503 från Anthropic → draft-routen returnerar 200 med `triage: "skipped: ai_transient_error"`, inte 500
- Audit log visar `ai_draft_skipped` med reason

---

## 12.3 — Fixa `as unknown as`-casts i stats och gmail

**Prio:** P2  
**Estimat:** 1h

**Problem:** Drizzle `db.execute()` returnerar `unknown` och koden castar med `as unknown as X` på flera ställen. Det döljer potentiella datakorruptioner.

**Filer:**
- `src/lib/admin/health.ts` rad ~42, ~64
- `src/lib/app/stats.ts` rad ~256, ~282, ~329
- `src/lib/app/threads.ts` rad ~174, ~203

**Lösning:** Byt `db.execute(sql`...`)` mot Drizzle:s typade query-builder där möjligt. Annars: definiera ett explicit Zod-schema och parse:a resultatet (kastar vid fel istället för att tyst fortsätta med fel data).

```typescript
// Exempel-mönster:
const ResultSchema = z.array(z.object({ count: z.number() }));
const raw = await db.execute(sql`SELECT count(*) FROM ...`);
const result = ResultSchema.parse(raw.rows);
```

**Done när:**
- Inga `as unknown as` kvar i de listade filerna
- `npm run typecheck` är grön

---

---

# Fas 13 — Microsoft 365 / Outlook OAuth

> **Låst beslut** sedan dag 1 (se `CLAUDE.md`). Detta är den viktigaste integrationen — de flesta svenska SMB-företag använder Microsoft 365, inte Gmail.

---

## 13.1 — Azure AD-app + OAuth-flöde

**Prio:** P0  
**Estimat:** 3h

**Analogt med Gmail:** `src/lib/app/gmail.ts` + `src/app/api/app/inboxes/gmail/`

**Kräver Azure-portalen (Sebastian gör detta manuellt innan du börjar):**
- App-registrering i Azure → `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` i Vercel
- Scopes: `Mail.Read`, `Mail.Send`, `offline_access`, `User.Read`
- Redirect URI: `https://mailmind.se/api/app/inboxes/microsoft/callback`

**Att bygga:**

*Ny fil: `src/lib/app/microsoft.ts`*
- `buildOAuthUrl(state)` — generera Microsoft OAuth-URL
- `exchangeCode(code)` — hämta access + refresh tokens via Graph API
- `refreshAccessToken(refreshToken)` — förnya token
- `getValidAccessToken(inbox)` — hämta giltig token, förnya vid behov
- `getMicrosoftEmail(token)` — hämta UPN/e-postadress via `/me`
- `sendViaMicrosoft(token, to, subject, body, threadRef?)` — skicka via Graph API `/me/sendMail`
- `encryptTokens` / `decryptTokens` — **återanvänd exakt samma AES-256-GCM-logik som i gmail.ts**, samma `GMAIL_TOKEN_ENCRYPTION_KEY`

*Nya routes:*
- `src/app/api/app/inboxes/microsoft/auth/route.ts` — GET, sätter CSRF-cookie, redirectar till Microsoft
- `src/app/api/app/inboxes/microsoft/callback/route.ts` — validerar state, byter code mot tokens, skapar inbox med provider `"microsoft"`, anropar `subscribeToMailbox()`

*Graph API mailbox-prenumeration:*
- `subscribeToMailbox(token, inboxId)` — POST till `/subscriptions`, push-notiser till `/api/webhooks/microsoft/push`
- Prenumerationer löper ut efter 4320 minuter (3 dagar) — implementera förnyelse-cron (se 13.2)

*Inbound webhook:*
- `src/app/api/webhooks/microsoft/push/route.ts` — tar emot Graph-notiser, hämtar meddelanden via `/me/messages/{id}`, parsar, skapar EmailThread + EmailMessage, anropar `autoTriageNewMessage()`

**Uppdatera:**
- `src/lib/app/autoSend.ts` — `executeSendDraft()`: om `inbox.provider === "microsoft"` → `sendViaMicrosoft()`
- `src/app/(portal)/app/inboxes/InboxesEditor.tsx` — lägg till "Koppla Microsoft 365"-knapp

**Done när:**
- Kund kan koppla sitt Microsoft 365-konto via OAuth
- Inkommande mejl triggar AI-pipeline
- Svar skickas via Graph API

---

## 13.2 — Microsoft subscription-förnyelse cron

**Prio:** P1  
**Estimat:** 1h

**Problem:** Graph API-prenumerationer löper ut efter 3 dagar och måste förnyas.

**Att bygga:**
1. Ny route `src/app/api/cron/microsoft-renew/route.ts`
2. Hämta alla inkorgar med `provider = "microsoft"`
3. För varje: anropa Graph API `/subscriptions/{id}` PATCH med ny `expirationDateTime` (+3 dagar)
4. Lägg till i `vercel.json`: `"schedule": "0 6 * * *"` (dagligen 06:00 UTC)

**Done när:**
- Microsoft-inkorgar slutar inte ta emot mejl efter 3 dagar

---

---

# Fas 14 — Veckovis e-postrapport

---

## 14.1 — Bygg rapport-cron och Resend-mall

**Prio:** P2  
**Estimat:** 2h

**Värde:** Kunden ser Mailminds värde varje måndag utan att logga in.

**Att bygga:**

*Ny route `src/app/api/cron/weekly-report/route.ts`:*
1. Skyddad av `CRON_SECRET`
2. Hämta alla orgar med aktiv prenumeration (`status IN ('active', 'trialing')`)
3. Per org: hämta för senaste 7 dagar:
   - Antal inkommande trådar
   - Antal AI-utkast genererade
   - Antal autosvar skickade
   - Antal eskaleringar
   - Genomsnittlig svarstid (om data finns)
4. Skicka via Resend till org-ägarens e-post

*E-postmall (HTML-sträng i Resend-anropet):*
- Enkel, mörk design som matchar Mailmind-temat
- Siffrorna i stort typsnitt
- CTA: "Öppna Mailmind →"
- Avregistreringslänk i footer (kräver kolumn `weeklyReportEnabled boolean DEFAULT true` i `organizations` — meddela Sebastian för `db:push`)

*Lägg till i `vercel.json`:*
```json
{
  "path": "/api/cron/weekly-report",
  "schedule": "0 8 * * 1"
}
```

**Done när:**
- Cron-jobbet körs och skickar mejl till test-org (Sebastian verifierar)
- Avregistreringslänk fungerar och sätter `weeklyReportEnabled = false`

---

---

# Fas 15 — Team & roller

---

## 15.1 — Bjud in teammedlemmar

**Prio:** P2  
**Estimat:** 3h

**Värde:** Pilotkunder vill ha minst 2 användare. Idag är `/dashboard/team` en platshållare.

**Filer att läsa:**
- `src/app/(portal)/dashboard/team/page.tsx`
- `src/lib/db/schema.ts` — `users`-tabellen
- `src/lib/app/entitlements.ts` — `account.access.canInviteUser`, `account.entitlements.maxUsers`
- Clerk Organizations docs: https://clerk.com/docs/organizations/overview

**Att bygga:**
1. Lista nuvarande medlemmar: `SELECT * FROM users WHERE organizationId = ?`
2. Ny route `POST /api/app/team/invite` — anropar Clerk `organization.inviteMember({ emailAddress, role })`
3. Visa pending invitations via Clerk `organization.getInvitations()`
4. Roller: `admin` (full access) / `agent` (inkorg + draft, ej inställningar)
5. "Ta bort"-knapp — bara synlig för admin-roll
6. Respektera `maxUsers`: visa "Uppgradera plan"-banner när full

**Done när:**
- Kund kan bjuda in kollega, kollegan loggar in och ser inkorgen
- Inbjudningar syns som "väntande" tills accepterade
- Att bjuda in när full visar tydligt fel med länk till billing

---

---

# Fas 16 — Kundhistorik & AI-kontext

---

## 16.1 — Koppla CustomerHistory-panel till AI-pipeline

**Prio:** P2  
**Estimat:** 2h

**Värde:** AI:n vet idag ingenting om att en kund reklamerat 3 gånger tidigare. Det ger sämre svar och missar eskalering.

**Filer att läsa:**
- `src/app/(portal)/app/thread/[id]/CustomerHistory.tsx` — finns redan, visar trådar per avsändare
- `src/lib/app/ai.ts` — `buildSystemPrompt()`
- `src/lib/app/threads.ts` — `listThreads()`

**Att bygga:**
1. Ny funktion `getCustomerContext(orgId, fromEmail)` i `src/lib/app/threads.ts`:
   - Hämta senaste 5 stängda trådar från samma avsändare
   - Returnera: antal totalt, ämnen, ärendetyper, lösningar
2. Injicera i `buildSystemPrompt()` som ett nytt block:
   ```
   KUNDHISTORIK:
   - 3 tidigare ärenden från anna@foretag.se
   - 2026-04-01: Reklamation (löst)
   - 2026-03-15: Offertförfrågan (eskalerat)
   ```
3. CustomerHistory-panelen är redan byggd — verifiera att den visar korrekt data

**Done när:**
- AI-prompten innehåller kundhistorik för återkommande avsändare
- Ny kund (0 historik) påverkas inte

---

---

# Fas 17 — Prissättning & konvertering

---

## 17.1 — Förbättra trial-bannern med planpris

**Prio:** P2  
**Estimat:** 30 min

**Problem:** Trial-bannern vid ≤3 dagar kvar är röd men säger inte vad uppgradering kostar.

**Fil:** `src/app/(portal)/app/page.tsx` — `TrialBanner`

**Att bygga:**
- Hämta nuvarande plan + pris via `PLANS[planKey]`
- Visa "Behåll [planName] för [pris]/mån" direkt i bannern vid ≤3 dagar
- Knappen → `/dashboard/billing`

**Done när:**
- Kund med 2 dagar kvar ser planpris och CTA utan att klicka in i billing

---

## 17.2 — Referral-kod: ge en månad gratis

**Prio:** P3  
**Estimat:** 4h

**Värde:** Word-of-mouth-tillväxt. Varje kund som hänvisar en ny kund får 1 månad gratis.

**Att bygga:**
1. `referralCode` kolumn (nanoid, 8 tecken) på `organizations` — meddela Sebastian för `db:push`
2. Generera vid org-skapande (i onboarding-API)
3. Sida `/app/referral` — visa kod + delningslänk: `mailmind.se/signup?ref=XXXXXXXX`
4. Signup-flöde: om `?ref=` finns → spara `referredByOrgId` på nya orgen
5. Webhook eller cron: när refererad kund betalar sin första faktura → lägg Stripe-kredit på referentens konto via `stripe.customers.createBalanceTransaction({ amount: -price_of_one_month })`

**Done när:**
- Kod genereras för alla orgar
- Referens-länk fungerar och kopplar ny kund till referent
- Stripe-kredit läggs automatiskt (kan verifieras i Stripe dashboard)

---

---

# Fas 18 — PWA & mobilnotiser

> Påbörja inte denna fas förrän Fas 13–17 är klara och minst 5 betalande kunder är aktiva.

---

## 18.1 — Progressive Web App

**Prio:** P3  
**Estimat:** 2h

**Att bygga:**
1. `public/manifest.json` — ikon, namn, tema-färg (`#030614`), `display: standalone`
2. Service worker via Next.js `next-pwa` (kolla `package.json` först — lägg inte till utan att motivera)
3. Offline-sida: visa senaste laddade trådar, tydligt meddelande om anslutning saknas

---

## 18.2 — Web Push-notiser vid nytt ärende

**Prio:** P3  
**Estimat:** 3h

**Att bygga:**
1. Web Push API-prenumeration vid inloggning (fråga om tillstånd)
2. Spara `PushSubscription` per user i DB
3. Trigga notis från `autoTriageNewMessage()` när nytt ärende klassificeras
4. Notisen: "Nytt ärende: [ämne] — [ärendetyp]" med länk till tråden

**Done när:**
- Kund med PWA-installerad och notistillstånd får push inom 5s efter att mejl landat

---

---

# Fas 6e — Manuella ops (Sebastian + Emil)

> **Ingen kod.** Dessa är infra-åtgärder som måste göras av kontoägarna. Fas 6e kan köras parallellt med Fas 11.

### Checklista

- [ ] **Live Stripe-nycklar** — byt `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` i Vercel. Registrera live webhook i Stripe Dashboard → `https://mailmind.se/api/webhooks/stripe`. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

- [ ] **SendGrid Inbound Parse-MX** — sätt MX för `mail.mailmind.se` → `mx.sendgrid.net` prio 10 i Loopia. Konfigurera Inbound Parse i SendGrid: hostname `mail.mailmind.se`, URL `https://mailmind.se/api/webhooks/sendgrid/inbound`.

- [ ] **UNIQUE index i Neon** — kör i Neon SQL Editor:
  ```sql
  DELETE FROM email_messages
  WHERE id NOT IN (
    SELECT DISTINCT ON (external_message_id) id
    FROM email_messages
    ORDER BY external_message_id, created_at ASC
  );
  CREATE UNIQUE INDEX IF NOT EXISTS email_messages_external_id_uniq
    ON email_messages (external_message_id)
    WHERE external_message_id IS NOT NULL;
  ```

- [ ] **Google OAuth consent screen** — lägg till `mailmind.se` som authorized domain och skicka in för verifiering (krävs för externa Gmail-användare utanför test-listan).

- [ ] **Azure AD-app** (inför Fas 13) — registrera app i Azure Portal, lägg till scopes `Mail.Read Mail.Send offline_access User.Read`, sätt redirect URI `https://mailmind.se/api/app/inboxes/microsoft/callback`. Spara `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` i Vercel.
