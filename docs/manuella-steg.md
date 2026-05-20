# Manuella steg att köra

> Kortlista över allt som måste göras manuellt (utanför kod-repot) för att
> aktivera det senaste arbetet. Bockar du av varje steg när det är klart.

---

## 🔴 Kritiskt — gör nu

### Steg 0 — Vercel env-vars för e-postformulär (5 min)

För att formulär faktiskt ska leverera till dig krävs tre env-vars i Vercel:

| Variabel | Värde | Vad det styr |
|---|---|---|
| `RESEND_API_KEY` | `re_xxx` från resend.com | All utgående mejl |
| `DEMO_REQUEST_TO` | din mottagaradress | Vart "Boka demo"-formulär går |
| `DEMO_REQUEST_FROM` | `Mailmind <noreply@mailmind.se>` (verifierad i Resend) | Avsändare för demo-mejl |
| `SUPPORT_EMAIL_TO` | din mottagaradress (kan vara samma som ovan) | Vart support-drawerns meddelanden går |

Sätts inte `SUPPORT_EMAIL_TO` faller den tillbaka på `support@mailmind.se` — om den adressen inte landar i en mailbox du läser **försvinner meddelandena tyst**. Kolla Vercel-loggar om något inte når dig.

- [x] Klart

---

### Steg 0b — Upstash Redis (distribuerad rate-limiting) (5 min)

`@upstash/ratelimit` och `@upstash/redis` är nu installerade. Utan env-vars faller
limitern tyst tillbaka på in-memory (fungerar, men varje serverless-instans räknar
separat — en angripare kan nå olika instanser och överstiga gränsen).

**a) Skapa Redis-databas**
1. Gå till **console.upstash.com** → **Create Database**
2. Välj **Region: eu-west-1** (närmast Sverige)
3. Kopiera **REST URL** och **REST Token** från databas-sidan

**b) Lägg till i Vercel**
Vercel → Settings → Environment Variables → lägg till:

| Name | Value | Environments |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | `https://xxx.upstash.io` | Production, Preview |
| `UPSTASH_REDIS_REST_TOKEN` | `AXxx...` | Production, Preview |

Inget i Development behövs — lokal dev kör in-memory automatiskt.

**c) Verifiera** efter nästa deploy: Vercel-loggar ska inte visa `[rate-limit] Redis error`.

- [x] Klart

---

### Steg 1 — `npm run db:push` (30 sek)

```powershell
cd "C:\Users\sebbe\Downloads\Claude\Email AI\mailmind-landing"
npm run db:push
```

Säg **`yes`** på alla frågor. Skapar nya kolumner:
- `email_messages.organization_id` (P2.3 defense-in-depth)
- Nya index: `email_messages_org_idx`, `email_threads_org_from_idx`
- DESC-ordning på `email_threads_org_updated_idx`

**Förväntat:** `[✓] Changes applied`

- [x] Klart

---

### Steg 2 — Backfill `email_messages.organization_id` (10 sek)

Logga in på **console.neon.tech** → välj din DB → **SQL Editor**. Klistra in:

```sql
UPDATE email_messages m
   SET organization_id = t.organization_id
  FROM email_threads t
 WHERE m.thread_id = t.id
   AND m.organization_id IS NULL;

-- Verifiera (förväntat: 0)
SELECT COUNT(*) AS unmapped FROM email_messages WHERE organization_id IS NULL;
```

- [x] Klart

---

### Steg 3 — Verifiera Vercel-deploy (2 min)

1. Gå till **vercel.com** → ditt projekt → **Deployments**
2. Senaste deploy ska visa **Ready** (grön)
3. Klicka på den → **Functions** → kolla att inga 500-fel

- [x] Klart

---

## 🟡 Rekommenderat — gör snart

### Steg 4 — Google Pub/Sub OIDC (10 min, om Gmail används)

**Hoppa över om du inte använder Gmail-integrationen.**

**a) Lägg till env i Vercel:**
- Settings → Environment Variables → **Add New**
- Name: `GMAIL_PUSH_OIDC_AUDIENCE`
- Value: `https://mailmind.se/api/webhooks/gmail/push`
- Environments: alla tre (Production + Preview + Development)

**b) Konfigurera Pub/Sub i Google Cloud:**
1. **console.cloud.google.com** → välj projekt
2. **Pub/Sub** → **Subscriptions** → klicka din `mailmind-gmail-push`
3. **Edit** → scrolla till **Authentication** → **Enable authentication**
4. **Service account:** välj eller skapa `mailmind-pubsub-sa@PROJEKT.iam.gserviceaccount.com`
5. **Audience:** `https://mailmind.se/api/webhooks/gmail/push` (exakt match)
6. **Save**

**c) Redeploy** (Vercel deployar automatiskt vid env-ändring, vänta 1-2 min)

**d) Verifiera:** Skicka test-mejl till din Gmail-kopplade inkorg → kolla Vercel-loggarna:
- ✅ Inget JWT-fel = funkar
- ❌ `kid_not_found` = vänta 5 min, Google har inte börjat signera än
- ❌ `bad_audience` = audience matchar inte exakt

- [ ] Klart (eller skippad — Gmail inte i bruk)

---

### Steg 5 — Stripe trial_will_end webhook (2 min)

1. **dashboard.stripe.com** (live mode om aktiverat, annars test)
2. **Developers** → **Webhooks** → klicka `https://mailmind.se/api/webhooks/stripe`
3. **+ Select events** → bocka i `customer.subscription.trial_will_end`
4. **Update endpoint**

Trippar 3 dagar innan trial-slut → påminnelsemejl skickas.

- [x] Klart

---

### Steg 6 — Sentry-aktivering (5 min, valfritt)

För error-monitoring innan första pilot:

1. Skapa konto på **sentry.io** → **Create Project** → **Next.js**
2. Kopiera **DSN** (ser ut som `https://abc@o12345.ingest.sentry.io/67890`)
3. Vercel env vars:
   - `SENTRY_DSN` = DSN
   - `NEXT_PUBLIC_SENTRY_DSN` = SAMMA DSN
4. Redeploy (Vercel → Deployments → senaste → ⋯ → Redeploy)

- [ ] Klart

---

## 🟢 När du vill skala — gör vid behov

### Steg 7 — Annual pricing aktivering (20 min)

Koden är klar. Du behöver göra tre saker manuellt:

#### 7a — Skapa årsabonnemangs-priser i Stripe (10 min)

1. **dashboard.stripe.com** → **Product catalog** → klicka Mailmind-produkten
2. **+ Add another price** för varje plan (Starter, Team, Business):
   - **Pricing model:** Standard
   - **Billing period:** Yearly
   - **Belopp:**
     - Starter: €189 / år
     - Team: €488 / år
     - Business: €986 / år
3. Kopiera de tre nya price-IDs (`price_xxx`)

#### 7b — Lägg in env-variabler i Vercel (5 min)

Vercel → Settings → Environment Variables → lägg till:

| Name | Value | Environments |
|---|---|---|
| `STRIPE_PRICE_ID_STARTER_ANNUAL` | `price_xxx` | Production, Preview |
| `STRIPE_PRICE_ID_TEAM_ANNUAL` | `price_xxx` | Production, Preview |
| `STRIPE_PRICE_ID_BUSINESS_ANNUAL` | `price_xxx` | Production, Preview |

#### 7c — Kör db:push för ny kolumn (30 sek)

```powershell
cd "C:\Users\sebbe\Downloads\Claude\Email AI\mailmind-landing"
npm run db:push
```

Lägger till kolumnen `billing_period` på `subscriptions`-tabellen.

**Förväntat:** `[✓] Changes applied`

- [ ] 7a klart
- [ ] 7b klart
- [ ] 7c klart

---

### Steg 8 — PostHog EU aktivering (10 min)

PostHog är nu installerat och instrumenterat i koden. Aktivera med tre env-variabler i Vercel:

1. Skapa konto på **eu.posthog.com** (PostHog Cloud EU — GDPR-kompatibelt)
2. **Project Settings → Project API key** → kopiera nyckeln (börjar med `phc_`)
3. Vercel → Settings → Environment Variables → lägg till:

| Name | Value | Environments |
|---|---|---|
| `POSTHOG_KEY` | `phc_xxxx` | Production, Preview, Development |
| `NEXT_PUBLIC_POSTHOG_KEY` | `phc_xxxx` (samma) | Production, Preview, Development |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://eu.i.posthog.com` | Production, Preview, Development |

4. Redeploy (automatisk vid env-ändring)

**Vad som spåras utan mer kod:**
- `signup.completed` + identify + group vid onboarding
- `first_ai_draft_approved` vid första AI-utkast
- `first_ai_draft_sent` vid första skickat svar
- `upgrade.completed` vid betalning via Stripe
- `churn.cancelled` vid avslut

**Client-side events att koppla (kallar `captureEvent` från `@/lib/client/analytics`):**
- `landing.cta_clicked` — lägg i Hero/Pricing/Footer-knapparna
- `onboarding.step_started/completed` — lägg i OnboardingForm.tsx

- [x] Klart

---

## 🚀 Inför första betalande kund

### Steg 9 — Starta AB via verksamt.se

Detaljer i `docs/launch-roadmap.md`. Sammanfattning:
- Bolagsverket-avgift: 2 200 kr
- Aktiekapital: 25 000 kr (behåller du som bolagets pengar)
- SNI-kod: 62.010 eller 63.110
- Bolagsnamn: kolla ledighet på bolagsverket.se

- [ ] Klart

### Steg 10 — Ersätt placeholders i kod

Efter AB-bildning, sök & ersätt i hela repot:
- `[BOLAGSNAMN AB]` → riktigt bolagsnamn
- `[XXXXXX-XXXX]` → org-nr
- `[ADRESS]`, `[STAD]`, `[POSTNR]`
- `[DATUM]` → publiceringsdatum för Terms/Privacy/DPA

- [ ] Klart

### Steg 11 — Stripe live-keys i Vercel

- `STRIPE_SECRET_KEY` → byt från test till live
- `STRIPE_WEBHOOK_SECRET` → ny från live-webhook
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → live

- [ ] Klart

### Steg 12 — Registrera live Stripe-webhook

Endpoint: `https://mailmind.se/api/webhooks/stripe`
Events att lyssna på (minimum):
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

- [ ] Klart

---

## Sammanfattning

| Prio | Steg | Tid | Status |
|---|---|---|---|
| 🔴 | 0b. Upstash Redis env-vars | 5 min | [x] |
| 🔴 | 1. `npm run db:push` | 30 sek | [x] |
| 🔴 | 2. Backfill SQL i Neon | 10 sek | [x] |
| 🔴 | 3. Verifiera Vercel-deploy | 2 min | [x] |
| 🟡 | 4. Google Pub/Sub OIDC | 10 min | [ ] |
| 🟡 | 5. Stripe trial_will_end event | 2 min | [x] |
| 🟢 | 6. Sentry-aktivering | 5 min | [ ] |
| 🟢 | 7. Annual pricing Stripe | 15 min | [ ] |
| 🟢 | 8. PostHog/Plausible | 10 min | [x] |
| 🚀 | 9. Starta AB | — | [ ] |
| 🚀 | 10. Ersätt placeholders | — | [ ] |
| 🚀 | 11. Stripe live keys | — | [ ] |
| 🚀 | 12. Live webhook | — | [ ] |
| 🔴 | 13. `db:push` (sending + triage_failed) | 30 sek | [ ] |
| 🔴 | 14. DNS — SPF/DKIM/DMARC för mailmind.se | 20 min | [ ] |
| 🟡 | 15. Google OAuth verification | 1–2 v | [ ] |

### Steg 13 — db:push för nya schema-ändringar (30 sek)

Lägger till:
- Enum-värde `sending` på `draft_status` (atomic double-send guard)
- Kolumn `triage_failed` på `email_threads` (Dead Letter Queue för AI-fel)

```powershell
cd "C:\Users\sebbe\Downloads\Claude\Email AI\mailmind-landing"
npm run db:push
```

- [ ] Klart

---

---

### Steg 14 — DNS-records för mailmind.se (20 min)

**Varför:** Utan korrekta SPF/DKIM/DMARC-records hamnar mejl från Mailmind
(veckorapporter, demoförfrågningar, transaktionella notiser) i Gmail/Outlook
skräpkorgen. Det här är **inte** valfritt — det är hygienkrav 2025.

**a) Verifiera domänen i Resend**
1. **resend.com** → **Domains** → **Add Domain** → `mailmind.se`
2. Resend ger dig 3–4 DNS-records som ska skapas:
   - 1 × MX-record (för bounce-hantering)
   - 1 × TXT (SPF) — ungefär `v=spf1 include:amazonses.com ~all`
   - 2 × CNAME (DKIM) — `resend._domainkey...`

**b) Lägg in records hos din domänregistrar** (Loopia, Binero, GoDaddy, etc.)
- Logga in på registrar-kontot → DNS-zon för `mailmind.se`
- Lägg till varje record exakt som Resend visar (kopiera-klistra)
- TTL: lämna default (typ 3600s)

**c) DMARC-record (extra steg, GÖR DET)**
Lägg till denna TXT-record på hostname `_dmarc.mailmind.se`:
```
v=DMARC1; p=quarantine; rua=mailto:dmarc@mailmind.se; pct=100; adkim=s; aspf=s
```
- `p=quarantine` = misslyckade mejl hamnar i skräp (`p=reject` är striktare men kan blockera legitim trafik tidigt)
- `rua=` = vart aggregat-rapporter skickas (sätt en mailbox du läser)

**d) Verifiera i Resend**
- Vänta 5–30 min på DNS-propagering
- Resend → Domains → klicka på `mailmind.se` → **Verify**
- Alla 4 records ska visa grönt ✅

**e) Bonustest:** Skicka ett testmejl till `check-auth@verifier.port25.com` —
du får ett svar med betyg på SPF/DKIM/DMARC.

- [ ] DNS-records skapade hos registrar
- [ ] Resend visar grönt på alla records
- [ ] DMARC `_dmarc.mailmind.se` lagts till
- [ ] Port25-test ger "pass" på SPF + DKIM + DMARC

---

### Steg 15 — Google OAuth verification (1–2 veckor)

**Varför:** Utan verifiering visar Gmail "This app isn't verified" och
begränsar antalet användare som kan koppla sitt Gmail till 100 totalt.
Verifiering tar 1–2 veckor från Google's sida och kräver bevis.

**a) Förbered scope-justifications**
Använd texterna i `docs/google-oauth-justifications.md` (skapad i denna commit).
Klistra in en text per scope-fält i Google Cloud Console.

**b) Spela in demo-video (3–5 min)**
Innehåll i ordning:
1. Logga in på Mailmind
2. Klicka "Koppla Gmail" → OAuth-samtycke visas → godkänn
3. Visa att ett inkommande mejl dyker upp i Mailmind-inkorgen
4. AI genererar ett utkast → användaren ser draftet
5. Användaren godkänner → svaret skickas
6. Öppna Gmail-mappen "Skickat" → visa att svaret är där

Spela in med t.ex. Loom eller OBS. Ladda upp på YouTube som **Unlisted**
(inte Public, inte Private). Klistra in länken i Google Cloud Console.

**c) Lämna in för granskning**
- **console.cloud.google.com** → välj projekt
- **APIs & Services** → **OAuth consent screen** → **Publish app** → fyll i justifications + video
- Submit. Du får mejl från Google inom 3–10 arbetsdagar med antingen
  godkännande eller frågor som behöver besvaras.

**d) Under väntan**
Du kan fortfarande utveckla och testa — du har en quota på 100 användare
under "Testing"-status. Det räcker för pilot.

- [ ] Justifications klistrade in
- [ ] Demo-video uppladdad på YouTube (Unlisted)
- [ ] Submit för verifiering
- [ ] Verifiering godkänd

---

**Minimum för att senaste pushen ska funka i prod:** 0b + 1 + 2 + 3 + 13
**Minimum för att veckorapport ska nå inkorgen, ej skräp:** 14
**Minimum för publik Gmail-integration utan 100-användarcap:** 15
**Minimum för pilot:** + 4 (om Gmail) + 5 + 6
**Innan första betalande kund:** allt
