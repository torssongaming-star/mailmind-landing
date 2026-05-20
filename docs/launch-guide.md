# Mailmind launch-guide

> Steg-för-steg för att gå från utvecklings-läge till produktions-redo.
> Kör i denna ordning — vissa steg är beroende av tidigare.
>
> **Aktiv tid:** ~1.5 timmar
> **Total tid:** ~2.5 timmar (DNS-propagering tar 30 min)

---

## Översikt — gör i denna ordning

| # | Steg | Aktiv tid | Vänta-tid |
|---|---|---|---|
| 1 | `db:push` (schema-sync) | 2 min | — |
| 2 | DNS-records för mailmind.se | 10 min | 30 min |
| 3 | Sentry-aktivering | 10 min | — |
| 4 | Stripe live-läge + nycklar | 20 min | — |
| 5 | Annual pricing i Stripe (live) | 15 min | — |
| 6 | Stripe live-webhook | 10 min | — |

**Stopp-punkter:** Stegen 4-6 är "no going back" på betalningssidan. Gör dem efter att du har en första pilotkund eller är ~1 vecka från lansering. Step 1-3 är riskfria och kan göras direkt.

---

## Steg 1 — `npm run db:push` (2 min)

**Varför:** Lägger till `sending`-värdet i `draft_status`-enum och `triage_failed`-kolumnen i `email_threads`. Utan detta kraschar koden vid första försök att markera en draft som "sending" eller en tråd som triage-failed.

### Förkrav
- Du är i projektmappen i terminalen
- `.env.local` har `DATABASE_URL` satt (pekar på din Neon-databas)

### Kör

```powershell
cd "C:\Users\sebbe\Downloads\Claude\Email AI\mailmind-landing"
npm run db:push
```

Drizzle visar förändringarna och frågar **Yes/No** på varje. Svara **`yes`** på alla.

### Verifiera

Förväntad output: `[✓] Changes applied`

Logga in på **console.neon.tech** → SQL Editor → kör:

```sql
-- Förväntat: värdet "sending" finns
SELECT unnest(enum_range(NULL::draft_status)) AS values;

-- Förväntat: kolumnen finns, defaultvärde false
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'email_threads' AND column_name = 'triage_failed';
```

### Felmoder
- "permission denied" → DATABASE_URL pekar på fel användare/role. Kontrollera att rollen har CREATE-behörighet.
- "type already exists" → enum-värdet finns redan, ofarligt. Tryck `n` på den prompten.

---

## Steg 2 — DNS-records för mailmind.se (10 min + 30 min vänta)

**Varför:** Utan SPF/DKIM/DMARC hamnar all utgående mejl (veckorapporter, demo-notiser, trial-påminnelser) i Gmail/Outlook skräp. Detta är hygienkravet 2025.

### 2a. Verifiera domänen i Resend

1. Gå till **[resend.com/domains](https://resend.com/domains)**
2. Klicka **Add Domain** → fyll i `mailmind.se`
3. Resend visar 3-4 DNS-records. Lämna fönstret öppet — du behöver kopiera värdena strax.

### 2b. Lägg in records hos din domänregistrar

Logga in på din registrar (Loopia, Binero, GoDaddy, One.com, etc.).

Hitta **DNS-zonen** för `mailmind.se`. Lägg till **exakt** dessa records (kopiera värdena från Resend):

| Typ | Namn (host) | Värde | TTL |
|---|---|---|---|
| MX | `send` (eller `send.mailmind.se`) | `feedback-smtp.eu-west-1.amazonses.com`, priority 10 | default |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | default |
| CNAME | `resend._domainkey` | (värde från Resend, börjar med `resend._domainkey.`) | default |
| CNAME | `resend2._domainkey` | (värde från Resend) | default |

**OBS:** Vissa registrarer (Loopia) lägger till `.mailmind.se` automatiskt. Skriv inte ut det själv då.

### 2c. Lägg till DMARC-record (gör inte detta hoppa över)

| Typ | Namn (host) | Värde |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@mailmind.se; pct=100; adkim=s; aspf=s` |

Vad det betyder:
- `p=quarantine` → mejl som failar autentisering hamnar i skräp (mildare än `reject` som blockerar helt)
- `rua=` → vart aggregat-rapporter skickas (sätt en mejladress du läser)
- `adkim=s` + `aspf=s` → strikt domain-alignment

### 2d. Verifiera

**Vänta 5-30 minuter** för DNS-propagering, sedan:

1. Resend → Domains → klicka `mailmind.se` → **Verify**
2. Alla records ska visa grönt ✅
3. Bonustest: skicka ett mejl till `check-auth@verifier.port25.com` — du får tillbaka en rapport. SPF, DKIM och DMARC ska alla visa **pass**.

### Felmoder
- "DNS check failed" → records är inte propagerade än, vänta 30 min till
- DKIM-records visar fel värde → kopiera om från Resend, vissa registrarer trimmar långa strängar
- DMARC-rapporter når aldrig fram → kolla att `dmarc@mailmind.se` faktiskt landar i en mailbox du läser

---

## Steg 3 — Sentry-aktivering (10 min)

**Varför:** Error-monitoring i produktion. Utan Sentry får du veta om buggar först när kunden mejlar dig.

### 3a. Skapa konto + projekt

1. Gå till **[sentry.io](https://sentry.io)** → Sign up
2. **VÄLJ EU REGION** (Frankfurt) under signup — GDPR-kompatibelt
3. Create Project → **Platform: Next.js**
4. Project name: `mailmind-prod`
5. På "Configure Sentry"-sidan — **kopiera DSN-strängen** (ser ut som `https://abc123@o12345.ingest.de.sentry.io/67890`)

### 3b. Lägg till i Vercel

**[vercel.com](https://vercel.com)** → ditt projekt → **Settings** → **Environment Variables**

Lägg till två variabler (samma värde i båda):

| Name | Value | Environments |
|---|---|---|
| `SENTRY_DSN` | `https://abc@o123.ingest.de.sentry.io/456` | Production |
| `NEXT_PUBLIC_SENTRY_DSN` | (samma värde) | Production |

### 3c. Redeploy

Vercel deployar automatiskt vid env-ändring. Vänta 1-2 minuter.

### 3d. Verifiera

1. Gå till `mailmind.se/api/admin/health?secret=...` (din admin-secret)
2. Eller medvetet tricka en error: besök en route som kraschar
3. Sentry → Issues — du ska se eventet inom 30 sekunder

`src/instrumentation.ts` initierar redan Sentry server-side, så ingen kod-ändring behövs.

### Felmoder
- "DSN invalid" → kontrollera att hela strängen kopierats, ingen newline
- Inga events i Sentry → kolla Vercel-loggen att deploy gick igenom utan fel

---

## Steg 4 — Stripe live-läge + nycklar (20 min)

**⚠️ Detta är "no going back"-punkten.** Efter detta kan du ta emot riktiga betalningar.

### 4a. Aktivera Stripe-kontot

Om du inte redan aktiverat:

1. **[dashboard.stripe.com](https://dashboard.stripe.com)** → längst upp till höger, växla från **Test mode** → **Live mode**
2. Stripe ber om aktiveringsinfo:
   - Företagsinformation (org-nr, adress)
   - Bankuppgifter för utbetalning
   - Personuppgifter för representanter
3. Lämna in. Stripe godkänner vanligtvis inom timmar för svenska AB:s.

**Om du inte har AB ännu:** stoppa här. Du måste ha företag registrerat på verksamt.se innan Stripe aktiveras (steg 9 i manuella-steg.md).

### 4b. Skapa produkter + priser i LIVE mode

⚠️ **Test-mode-produkterna överförs INTE automatiskt** — du måste skapa dem på nytt i live.

1. Stripe → **Product catalog** (i Live mode)
2. **+ Add product** → fyll i Mailmind-produktinfo
3. För varje plan, skapa ett pris:

| Plan | Belopp | Period |
|---|---|---|
| Starter | €19/månad | Monthly |
| Team | €49/månad | Monthly |
| Business | €99/månad | Monthly |

4. Kopiera **price-ID** för varje (`price_xxx`).

### 4c. Hämta live-API-nycklar

1. Stripe → **Developers** → **API keys** (i Live mode)
2. Kopiera:
   - **Publishable key** (`pk_live_...`)
   - **Secret key** (`sk_live_...`) — klicka "Reveal" först

### 4d. Lägg in i Vercel

Settings → Environment Variables. **Byt ut** existerande test-värden:

| Name | Value | Environments |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_xxx` | **Production only** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_xxx` | **Production only** |
| `STRIPE_PRICE_ID_STARTER` | `price_xxx` (live) | Production |
| `STRIPE_PRICE_ID_TEAM` | `price_xxx` (live) | Production |
| `STRIPE_PRICE_ID_BUSINESS` | `price_xxx` (live) | Production |

**Behåll test-nycklarna för Preview-environment.** Då kan du fortsätta testa utan att ta riktiga betalningar.

### 4e. Verifiera

1. Redeploy klar
2. Gå till `mailmind.se/dashboard/billing` (i incognito, så Clerk loggar in nytt)
3. Klicka "Välj plan" → du ska hamna på Stripes checkout med **belopp i €** och **inget "test mode"-band längst upp**

### Felmoder
- "No such price" → price-ID är från test-mode, måste vara live-värde
- "API key invalid" → kontrollera att hela `sk_live_` kopierats utan whitespace

---

## Steg 5 — Annual pricing i Stripe live (15 min)

**Varför:** Ge 15-20% rabatt på årsabonnemang för att öka LTV och minska churn.

### 5a. Lägg till årspriser i Stripe Live

1. Stripe (Live mode) → **Product catalog** → klicka Mailmind-produkten
2. För varje plan: **+ Add another price**
   - Pricing model: Standard
   - Billing period: **Yearly**
   - Belopp (~15% rabatt):

| Plan | Årspris |
|---|---|
| Starter | €189/år (motsv. €15.75/mån, sparar 17%) |
| Team | €488/år (motsv. €40.67/mån, sparar 17%) |
| Business | €986/år (motsv. €82.17/mån, sparar 17%) |

3. Kopiera de tre nya price-IDs.

### 5b. Lägg till i Vercel

| Name | Value | Environments |
|---|---|---|
| `STRIPE_PRICE_ID_STARTER_ANNUAL` | `price_xxx` | Production |
| `STRIPE_PRICE_ID_TEAM_ANNUAL` | `price_xxx` | Production |
| `STRIPE_PRICE_ID_BUSINESS_ANNUAL` | `price_xxx` | Production |

### 5c. Schema-push för annual-flaggan

```powershell
cd "C:\Users\sebbe\Downloads\Claude\Email AI\mailmind-landing"
npm run db:push
```

Lägger till `billing_period`-kolumnen på `subscriptions`.

### 5d. Verifiera

På `/dashboard/billing` ska du nu se en toggle "Månadsvis ⟷ Årligen" och pris-deltan visas korrekt.

---

## Steg 6 — Stripe live-webhook (10 min)

**Varför:** Utan webhook vet Mailmind inte när betalningar lyckas/misslyckas, när trials går ut, eller när någon avslutar. Subscriptions skulle sluta uppdateras.

### 6a. Skapa webhook-endpoint i Stripe

1. Stripe (Live mode) → **Developers** → **Webhooks** → **+ Add endpoint**
2. **Endpoint URL:** `https://mailmind.se/api/webhooks/stripe`
3. **Description:** `Mailmind production webhook`
4. **Events to listen to** — välj exakt dessa:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.trial_will_end`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Klicka **Add endpoint**.

### 6b. Kopiera signing secret

På webhookens sida, klicka **Reveal** under "Signing secret". Kopiera värdet (`whsec_xxx`).

### 6c. Lägg till i Vercel

| Name | Value | Environments |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxx` (live-värde) | Production |

Behåll test-mode-secret för Preview.

### 6d. Verifiera

1. Vänta på Vercel-deploy
2. Stripe → din webhook → **Send test webhook** → välj `checkout.session.completed` → Send
3. Stripe ska visa **200 OK**
4. Mailmind-loggarna i Vercel ska visa att eventet bearbetats

### Felmoder
- "401 Unauthorized" från Vercel → STRIPE_WEBHOOK_SECRET stämmer inte med Stripes signing secret
- "404 Not Found" → endpoint-URL skrev fel, måste vara `/api/webhooks/stripe`
- "500 Error" → kolla Vercel-loggar, troligen kod-bugg i webhook-handlern

---

## Efter alla 6 steg — checklista

- [ ] Steg 1: `npm run db:push` klart, `sending` enum + `triage_failed` kolumn finns
- [ ] Steg 2: Resend visar grönt på alla 4+1 records, port25-test ger pass
- [ ] Steg 3: Sentry tar emot events, EU-region
- [ ] Steg 4: Live API-nycklar i Vercel, checkout fungerar utan "test mode"-band
- [ ] Steg 5: Annual-priser skapade, toggle visas på billing-sidan
- [ ] Steg 6: Webhook 200 OK på test-event, alla 7 events listade

---

## Vad som händer om något går fel

| Steg | Rollback |
|---|---|
| 1 | Inget — schemat är additivt. Inget att rolla tillbaka. |
| 2 | Ta bort DNS-records hos registrar. Tar 30 min att propagera. |
| 3 | Ta bort SENTRY_DSN env-vars. Sentry tystnar omedelbart. |
| 4 | Byt tillbaka till `sk_test_` i Vercel. Befintliga live-prenumerationer påverkas inte men nya betalningar går till test. |
| 5 | Ta bort `_ANNUAL`-env-vars. UI:n döljer toggle. |
| 6 | Disable webhook i Stripe-dashboarden. Mailmind slutar få events. |

---

## När du är klar

Skicka ett testmejl till din egen Mailmind-inkorg från ett annat konto. Verifiera att:
1. Mejlet dyker upp i Mailmind ✅
2. AI-utkast genereras ✅
3. Du kan skicka svaret ✅
4. Svaret landar i mottagarens Inkorg (inte Skräp) ✅

Om alla 4 ✅ — **du är redo för första pilotkunden**.
