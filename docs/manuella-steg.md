# Manuella steg att köra

> Kortlista över allt som måste göras manuellt (utanför kod-repot) för att
> aktivera det senaste arbetet. Bockar du av varje steg när det är klart.

---

## 🔴 Kritiskt — gör nu

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

- [ ] Klart

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

- [ ] Klart

---

### Steg 3 — Verifiera Vercel-deploy (2 min)

1. Gå till **vercel.com** → ditt projekt → **Deployments**
2. Senaste deploy ska visa **Ready** (grön)
3. Klicka på den → **Functions** → kolla att inga 500-fel

- [ ] Klart

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

- [ ] Klart

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

### Steg 7 — Annual pricing i Stripe (15 min)

För +15-20% MRR via rabatterade årsabonnemang:

1. **Stripe Dashboard** → **Product catalog** → klicka Mailmind-produkten
2. **+ Add another price** för Starter / Pro / Business
3. **Pricing model:** Standard / Recurring
4. **Billing period:** Yearly
5. **Amount:** plan-pris × 12 × 0.83 (17% rabatt)
6. Kopiera price-IDs (`price_xxx`) och paste till mig → jag lägger in dem i koden

- [ ] Klart

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

- [ ] Klart

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
| 🔴 | 1. `npm run db:push` | 30 sek | [ ] |
| 🔴 | 2. Backfill SQL i Neon | 10 sek | [ ] |
| 🔴 | 3. Verifiera Vercel-deploy | 2 min | [ ] |
| 🟡 | 4. Google Pub/Sub OIDC | 10 min | [ ] |
| 🟡 | 5. Stripe trial_will_end event | 2 min | [ ] |
| 🟢 | 6. Sentry-aktivering | 5 min | [ ] |
| 🟢 | 7. Annual pricing Stripe | 15 min | [ ] |
| 🟢 | 8. PostHog/Plausible | 10 min | [ ] |
| 🚀 | 9. Starta AB | — | [ ] |
| 🚀 | 10. Ersätt placeholders | — | [ ] |
| 🚀 | 11. Stripe live keys | — | [ ] |
| 🚀 | 12. Live webhook | — | [ ] |

**Minimum för att senaste pushen ska funka i prod:** 1 + 2 + 3
**Minimum för pilot:** + 4 (om Gmail) + 5 + 6
**Innan första betalande kund:** allt
