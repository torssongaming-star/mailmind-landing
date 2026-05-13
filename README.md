# Mailmind — AI-driven e-postsupport för svenska SMB

Mailmind är en svensk B2B SaaS-plattform som använder AI för att triagera, klassificera och besvara inkommande kundmejl. Målgruppen är svenska SMB-företag (5–50 anställda) som drunknar i support-mejl utan att vilja implementera ett fullskaligt Zendesk.

Kunden kopplar sitt Gmail-konto via OAuth **eller** vidarebefordrar sin supportinkorg till en unik `<slug>@mail.mailmind.se`-adress. AI:n klassificerar mejlet, skriver ett utkast till svar och presenterar det för agenten — som granskar och skickar med ett klick. Ingen mail lämnar systemet utan ett mänskligt godkännande (om inte autosvar är aktiverat efter 20 godkända dry-run-iterationer).

---

## Innehållsförteckning

1. [Arkitekturöversikt](#arkitekturöversikt)
2. [Tech stack](#tech-stack)
3. [Projektstruktur](#projektstruktur)
4. [Flöden](#flöden)
5. [Miljövariabler](#miljövariabler)
6. [Lokal utveckling](#lokal-utveckling)
7. [Databas](#databas)
8. [Gmail OAuth-integration](#gmail-oauth-integration)
9. [AI-pipeline](#ai-pipeline)
10. [Autosvar-pipeline](#autosvar-pipeline)
11. [Onboarding](#onboarding)
12. [Admin-panel](#admin-panel)
13. [Deployment (Vercel)](#deployment-vercel)
14. [Produktionschecklista](#produktionschecklista)
15. [Kända begränsningar](#kända-begränsningar)

---

## Arkitekturöversikt

```
                        ┌─────────────────────┐
                        │   mailmind.se        │
                        │   (Next.js / Vercel) │
                        └────────┬────────────┘
                                 │
          ┌──────────────────────┼───────────────────────┐
          │                      │                       │
   ┌──────▼──────┐      ┌───────▼───────┐      ┌───────▼───────┐
   │  Landing    │      │ Portal /app   │      │ Admin /admin  │
   │  (public)   │      │ (Clerk auth)  │      │ (intern)      │
   └─────────────┘      └───────┬───────┘      └───────────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
             ┌──────▼──┐  ┌────▼────┐  ┌──▼──────────┐
             │  Inbox   │  │Tråd-    │  │ Inställ-    │
             │(split-   │  │detalj   │  │ ningar      │
             │ panel)   │  │+ Draft  │  │(KB, mallar, │
             └──────────┘  └─────────┘  │ ärendetyper,│
                                        │ webhooks)   │
                                        └─────────────┘

Inbound mail:
  Gmail (OAuth + Pub/Sub) ──► /api/webhooks/gmail/push
  SendGrid Inbound Parse  ──► /api/webhooks/sendgrid/inbound
       │
       ▼
  autoTriageNewMessage()
       │
       ├── classifyEmail() → ärendetyp + required fields
       ├── buildSystemPrompt() + KB-injektion
       ├── Claude Haiku → draft (ask / summarize / escalate)
       └── canAutoSend()? → executeSendDraft() : väntar på agent
```

**Multi-tenant:** Varje läsning/skrivning är scoped på `organizationId`. Aldrig trust client-supplied org id — alltid resolved server-side via `getCurrentAccount()`.

---

## Tech stack

| Område | Verktyg | Kommentar |
|---|---|---|
| Framework | Next.js 16 App Router | `src/app` — `(portal)`, `(admin)`, `api` |
| Auth | Clerk | Multi-tenant, middleware i `src/proxy.ts` |
| Databas | Neon Postgres | Serverless HTTP-driver |
| ORM | Drizzle ORM 0.45 | Schema i `src/lib/db/schema.ts` |
| Billing | Stripe | Checkout + portal + webhooks |
| Inbound mail | Gmail API (Pub/Sub) + SendGrid | Se sektion nedan |
| Outbound mail | Gmail API (Gmail-anslutna inkorgar) + Resend | |
| AI | Anthropic SDK — `claude-haiku-4-5-20251001` | Prompt caching aktiverat |
| Styling | Tailwind CSS | Dark glassmorphism-tema |
| Animationer | Framer Motion | Landing page |
| Hosting | Vercel | Auto-deploy från `main` |
| Charts | Recharts | Stats-dashboard |
| HTML-parsing | Cheerio | Web scrape för kunskapsbas |

---

## Projektstruktur

```
src/
├── app/
│   ├── (portal)/app/          # Kundens portal (Clerk-skyddad)
│   │   ├── page.tsx           # Startsida /app — guidad checklist
│   │   ├── inbox/             # Split-panel inkorg
│   │   ├── thread/[id]/       # Tråd + draft-editor
│   │   ├── settings/          # Inställningar (sidebar-nav)
│   │   │   ├── AiSettingsEditor.tsx
│   │   │   ├── CaseTypesEditor.tsx
│   │   │   ├── KnowledgeEditor.tsx
│   │   │   ├── KnowledgeSetupWizard.tsx   # Guidad KB-setup
│   │   │   ├── TemplatesEditor.tsx
│   │   │   ├── BlocklistEditor.tsx
│   │   │   └── WebhooksEditor.tsx
│   │   ├── onboarding/        # 5-stegs obligatorisk onboarding
│   │   │   ├── page.tsx
│   │   │   └── OnboardingForm.tsx
│   │   ├── inboxes/           # Koppla inkorgar (Gmail OAuth + forwarding)
│   │   ├── stats/             # Stats-dashboard (recharts)
│   │   └── activity/          # Aktivitetslogg
│   ├── (admin)/admin/         # Intern admin-panel
│   │   ├── organizations/     # Kundlista + detaljvy
│   │   ├── pilots/            # Leads + pilottrackning
│   │   ├── health/            # Systemhälsa
│   │   └── sideload/          # Outlook sideload-guide
│   ├── api/
│   │   ├── app/               # Portal-API:er (auth-skyddade)
│   │   │   ├── ai-settings/
│   │   │   ├── case-types/
│   │   │   ├── drafts/
│   │   │   ├── inboxes/
│   │   │   │   └── gmail/     # OAuth auth + callback
│   │   │   ├── knowledge/
│   │   │   │   ├── route.ts
│   │   │   │   ├── [id]/
│   │   │   │   ├── guided-setup/   # AI-genererade frågor + spara
│   │   │   │   └── scrape/         # Hemsida → KB-poster
│   │   │   ├── onboarding/
│   │   │   ├── threads/
│   │   │   ├── webhooks/
│   │   │   └── ...
│   │   └── webhooks/          # Inkommande webhooks
│   │       ├── clerk/         # User provisioning
│   │       ├── gmail/push/    # Pub/Sub push notifications
│   │       ├── sendgrid/inbound/
│   │       └── stripe/
├── lib/
│   ├── app/                   # Business logic
│   │   ├── ai.ts              # buildSystemPrompt + generateDraft
│   │   ├── autoSend.ts        # canAutoSend + executeSendDraft
│   │   ├── autoTriage.ts      # autoTriageNewMessage
│   │   ├── blocklist.ts
│   │   ├── entitlements.ts    # getCurrentAccount + plan-gates
│   │   ├── gmail.ts           # OAuth, token-kryptering, send, parse
│   │   ├── knowledge.ts
│   │   ├── threads.ts         # Kärnlogik: trådar, drafts, inkorgar
│   │   ├── webhooks.ts
│   │   └── ...
│   ├── db/
│   │   ├── schema.ts          # Drizzle-schema (källsanning)
│   │   ├── index.ts           # DB-anslutning
│   │   └── queries.ts         # syncUserAndOrganization m.fl.
│   ├── admin/                 # Admin-specifika queries + actions
│   └── plans.ts               # Plan-definitioner (Starter, Pro)
└── components/
    ├── admin/                 # Admin UI-komponenter
    └── ui/                    # Delade UI-komponenter
```

---

## Flöden

### Inkommande mejl (Gmail OAuth-väg)

```
1. Gmail tar emot mejl
2. Google Pub/Sub push → POST /api/webhooks/gmail/push
3. Webhook:
   a. Validerar Pub/Sub-signatur
   b. Stale historyId-guard (dedup)
   c. Dekrypterar Gmail-token → refreshar vid behov
   d. listHistory() → hämtar nya meddelanden
   e. Hoppar över egna skickade mejl
   f. Skapar/appendar EmailThread + EmailMessage (UNIQUE på external_message_id)
   g. Fire-and-forget: autoTriageNewMessage()
   h. Uppdaterar historyId i inbox.config

4. autoTriageNewMessage():
   a. findPendingDraft() — om draft redan finns → avbryt (dedup)
   b. assertCanGenerateAiDraft() — plan-gate
   c. listKnowledge() → aktivt KB injiceras i systemprompt
   d. Claude Haiku → JSON-svar: action, draft, confidence, risk_level, source_grounded
   e. Sparar draft med status "pending"
   f. canAutoSend()? → executeSendDraft() (skickar via Gmail API)
```

### Inkommande mejl (SendGrid-väg)

```
POST /api/webhooks/sendgrid/inbound
→ Parsar multipart/form-data
→ Extraherar headers (Message-ID, In-Reply-To, References)
→ Skapar/appendar tråd
→ autoTriageNewMessage() (samma pipeline som ovan)
```

### Manuellt svar (agent)

```
Agent öppnar tråd → klickar "Generera svar"
→ POST /api/app/ai/draft
→ assertCanGenerateAiDraft()
→ buildSystemPrompt() + KB
→ Claude Haiku → draft
→ Agent redigerar → godkänner
→ POST /api/app/drafts/[id] { action: "approve" }
→ executeSendDraft() → Gmail API eller Resend
```

---

## Miljövariabler

Skapa `.env.local` baserat på `.env.example`. Nedan är en komplett lista med förklaringar:

```bash
# ── Clerk (Auth) ──────────────────────────────────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...          # Clerk → /api/webhooks/clerk

# ── Databas ───────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://...           # Neon connection string

# ── Stripe (Billing) ──────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_...          # Använd sk_test_ lokalt
STRIPE_WEBHOOK_SECRET=whsec_...        # Stripe → /api/webhooks/stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_ID_STARTER_MONTHLY=price_...
STRIPE_PRICE_ID_PRO_MONTHLY=price_...

# ── Resend (Outbound mail) ────────────────────────────────────────────────────
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=support@mailmind.se
DEMO_REQUEST_FROM=noreply@mailmind.se
DEMO_REQUEST_TO=hello@mailmind.se

# ── Anthropic (AI) ────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── Gmail OAuth ───────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GMAIL_TOKEN_ENCRYPTION_KEY=<64 hex-tecken>   # AES-256-GCM nyckel
# Generera: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
GMAIL_PUBSUB_TOPIC=projects/<projekt-id>/topics/mailmind-gmail-push
# Lämna tom för att inaktivera Pub/Sub (forwarding-only mode)

# ── Inbound mail (SendGrid) ───────────────────────────────────────────────────
SENDGRID_INBOUND_WEBHOOK_SECRET=...    # Valfritt — för signaturvalidering

# ── App-URL ───────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://mailmind.se   # http://localhost:3000 lokalt
```

---

## Lokal utveckling

```bash
# 1. Klona
git clone https://github.com/torssongaming-star/mailmind-landing.git
cd mailmind-landing

# 2. Installera beroenden
npm install

# 3. Miljövariabler
cp .env.example .env.local
# Fyll i variabler (minst DATABASE_URL, Clerk-nycklar, ANTHROPIC_API_KEY)

# 4. Synka databas-schema
npm run db:push

# 5. Starta dev-server
npm run dev
# → http://localhost:3000

# Övriga kommandon
npm run build        # Produktionsbygge (testa innan deploy)
npm run typecheck    # TypeScript-kontroll
npm run lint         # ESLint
npm run db:studio    # Drizzle Studio (visuell DB-editor)
```

### Testa inkommande mail lokalt

För Gmail Pub/Sub lokalt krävs en publik URL (t.ex. via ngrok):
```bash
ngrok http 3000
# Uppdatera Pub/Sub-prenumerationens push-endpoint till ngrok-URL:n
```

För Stripe webhooks lokalt:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## Databas

Schema-källfil: `src/lib/db/schema.ts`

### Huvudtabeller

| Tabell | Syfte |
|---|---|
| `organizations` | En per kund-konto |
| `users` | Kopplade till Clerk `userId` |
| `inboxes` | Inkorgar per org — provider: `mailmind` eller `gmail` |
| `email_threads` | En tråd = en konversation med en kund |
| `email_messages` | Enskilda mejl i en tråd, UNIQUE på `external_message_id` |
| `ai_drafts` | AI-genererade svarsförslag |
| `case_types` | Ärendetyper (Offertförfrågan, Reklamation, etc.) |
| `knowledge_entries` | FAQ/fakta injicerade i AI-prompten |
| `reply_templates` | Sparade canned responses |
| `blocklist_entries` | Ignorerade avsändare/domäner |
| `webhook_endpoints` | Externa notifikationsmottagare |
| `webhook_deliveries` | Log över leveransförsök |
| `ai_settings` | Ton, språk, maxInteractions, signatur per org |
| `audit_logs` | Oföränderlig händelselogg |
| `usage_counters` | AI-draft-räknare per org + månad |

### Viktiga SQL-kommandon att köra manuellt i Neon

Dessa kan **inte** köras via `db:push` på grund av existerande data eller enum-begränsningar:

```sql
-- UNIQUE index på external_message_id (idempotency för inkommande mail)
-- Kör bara om det inte redan finns:
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

---

## Gmail OAuth-integration

### Förutsättningar i Google Cloud Console

1. Skapa ett projekt i [Google Cloud Console](https://console.cloud.google.com)
2. Aktivera **Gmail API** och **Cloud Pub/Sub API**
3. Skapa OAuth 2.0-klient (Web application):
   - Authorized redirect URI: `https://mailmind.se/api/app/inboxes/gmail/callback`
4. OAuth consent screen:
   - Scopes: `gmail.readonly`, `gmail.send`, `gmail.modify`
   - Lägg till `mailmind.se` som authorized domain
   - Skicka in för Google-verifiering för externa användare
5. Skapa Pub/Sub topic: `mailmind-gmail-push`
6. Skapa Pub/Sub prenumeration med push-endpoint: `https://mailmind.se/api/webhooks/gmail/push`
7. Ge Gmail API rättighet att publicera till topic:
   ```
   gcloud pubsub topics add-iam-policy-binding mailmind-gmail-push \
     --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
     --role="roles/pubsub.publisher"
   ```

### Token-säkerhet

Gmail OAuth-tokens lagras AES-256-GCM-krypterade i `inboxes.config` (JSONB). Krypteringsnyckeln (`GMAIL_TOKEN_ENCRYPTION_KEY`) är en 32-byte hex-sträng och får **aldrig** commitas eller loggas.

Generera en ny nyckel:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## AI-pipeline

### Modell

`claude-haiku-4-5-20251001` — snabb och kostnadseffektiv för klassificering + drafting. Prompt caching aktiverat med `cache_control: ephemeral` på systemprompt-blocket.

### Systemprompt (`src/lib/app/ai.ts`)

Varje AI-anrop innehåller:
- Organisationens namn + ton + språk
- Ärendetypernas definitioner (slug, label, required fields)
- Aktiva kunskapsbas-poster (FAQ, priser, policyer)
- Tråd-historik (tidigare meddelanden i konversationen)
- ABSOLUTA BEGRÄNSNINGAR: AI:n får aldrig uppskatta priser, kostnader eller ledtider som inte finns i kunskapsbasen

### Output-format

```json
{
  "action": "ask | summarize | escalate",
  "case_type": "offert",
  "collected_fields": { "namn": "Anna Svensson" },
  "missing_fields": ["personnummer"],
  "draft": "Hej Anna, tack för din förfrågan...",
  "confidence": 0.92,
  "risk_level": "low | medium | high",
  "source_grounded": true,
  "escalation_reason": null
}
```

### Kunskapsbas-wizard (`/settings` → Kunskapsbas)

Guided setup i tre steg:
1. **URL (valfritt)** — scrape hemsida → importerar 30+ FAQ-poster automatiskt
2. **AI genererar frågor** — Claude Haiku analyserar bransch och genererar 8–12 kundspecifika frågor med hints
3. **Användaren fyller i svar** — sparas som aktiva KB-poster

Web scrape-endpoint: `POST /api/app/knowledge/scrape` — upp till 16 000 tecken text, 30+ poster per import.

---

## Autosvar-pipeline

Autosvar är **hårt inlåst** bakom fyra villkor (alla måste vara uppfyllda):

```
confidence >= 0.90
source_grounded == true
risk_level == "low"
avsändaren ej blockerad
```

Dessutom krävs att **minst 20 dry-run-iterationer** har granskats och godkänts i admin-panelen innan autosvar kan aktiveras per organisation (`AutoSendPanel` i `/admin/organizations/[id]`).

`executeSendDraft()` i `src/lib/app/autoSend.ts` är delad logik för både manuell godkännande och autosvar.

---

## Onboarding

Ny användare som loggar in för första gången genomgår ett **obligatoriskt 5-stegflöde** innan de når `/app`:

| Steg | Innehåll | Obligatorisk? |
|---|---|---|
| 1. Konto | Företagsnamn | Ja |
| 2. Hemsida | Scrape → importera KB-poster automatiskt | Ja (men "har ingen hemsida"-väg finns) |
| 3. Ärendetyper | 4 förvalda + eget fält, minst 1 krävs | Ja |
| 4. AI-beteende | Ton, språk, max uppföljningsfrågor | Ja |
| 5. Notifikationer | Webhook-URL (förklaras i klartext) | Nej |

**Filosofi:** AI:n ska vara fullkittad dag 1. Inga tomma inkorgar, inga okonfigurerade ärendetyper.

Förvalda ärendetyper: Offertförfrågan, Bokningsförfrågan, Reklamation, Övrigt.

---

## Admin-panel

`/admin` — intern, ej exponerad i navigation för kunder.

| Vy | Funktion |
|---|---|
| `/admin/organizations` | Lista alla kund-orgar med plan + status |
| `/admin/organizations/[id]` | Hälsometrics, billing, dry-run-review, autosvar-toggle, interna anteckningar |
| `/admin/pilots` | CRM-light för leads — NextFollowUpAt, status, anteckningar |
| `/admin/health` | Live systemhälsa — DB, AI, mail-pipeline |
| `/admin/sideload` | Guide för Outlook-tillägget (manifest.xml) |

### Admin-provisioning

Ny kund sätts upp via `/admin/onboarding` — skapar org + trial + entitlements + AI-inställningar i ett steg utan att kunden behöver göra checkout.

---

## Deployment (Vercel)

Projektet deployas automatiskt från `main`-branchen via Vercel.

### Miljövariabler i Vercel

Lägg till alla variabler från [Miljövariabler](#miljövariabler)-sektionen i Vercel Dashboard → Settings → Environment Variables.

### Produktions-specifika steg

**Stripe:**
- Byt till live-nycklar (`sk_live_`, `pk_live_`)
- Registrera live webhook i Stripe Dashboard → `https://mailmind.se/api/webhooks/stripe`
- Events att lyssna på: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

**SendGrid Inbound Parse (forwarding-vägen):**
- Sätt MX-record för `mail.mailmind.se` → `mx.sendgrid.net` (prio 10) i DNS-hostingen (Loopia)
- Konfigurera Inbound Parse i SendGrid: hostname `mail.mailmind.se`, URL `https://mailmind.se/api/webhooks/sendgrid/inbound`

**Clerk:**
- Verifiera att produktionsdomänen `mailmind.se` är tillagd i Allowed Redirect URLs
- Registrera Clerk webhook → `https://mailmind.se/api/webhooks/clerk`

**Google/Gmail (för Gmail OAuth-flödet):**
- Lägg till `https://mailmind.se/api/app/inboxes/gmail/callback` som Authorized redirect URI
- Pub/Sub push-endpoint: `https://mailmind.se/api/webhooks/gmail/push`

---

## Produktionschecklista

### Teknisk

- [ ] Alla Vercel-miljövariabler ifyllda (Clerk, Stripe live, Resend, Anthropic, Gmail)
- [ ] `GMAIL_TOKEN_ENCRYPTION_KEY` genererad och sparad (32 bytes hex)
- [ ] Stripe live-nycklar aktiverade + webhook registrerad
- [ ] SendGrid MX-record satt för `mail.mailmind.se`
- [ ] SendGrid Inbound Parse konfigurerad
- [ ] Google OAuth consent screen godkänd + `mailmind.se` verifierad
- [ ] Pub/Sub topic + prenumeration konfigurerad med korrekt push-URL
- [ ] UNIQUE index på `email_messages.external_message_id` skapat i Neon (se SQL ovan)
- [ ] `npm run build` körd lokalt utan TypeScript/lint-fel
- [ ] Clerk webhook registrerad + secret sparad i Vercel

### Produkt

- [ ] Minst 20 dry-run-iterationer granskade i admin innan autosvar aktiveras
- [ ] Juridiska sidor (terms, privacy) genomgångna och godkända
- [ ] Onboarding-flödet testat end-to-end med ett riktigt Gmail-konto
- [ ] Kunskapsbas-wizard testat med en riktig hemsida-URL

---

## Kända begränsningar

- **Inget test-suite** — introducera inte ett utan att diskutera med projektägaren.
- **Inga retries på AI-anrop** — misslyckas tyst om Anthropic API är nere. Enkel exponential backoff saknas.
- **SendGrid är tillfällig lösning** — Resend Inbound kräver Pro-plan ($20/mån) för ny domän. Migration planeras när intäkter motiverar.
- **Outlook/Microsoft 365** — inte implementerat ännu. Är ett låst beslut som prioriteras i nästa iteration.
- **Juridiska sidor** — `terms` och `privacy` är platshållare. Måste granskas av jurist innan lansering.
- **Pub/Sub verifiering** — push-webhooket validerar inte Google-signaturen i nuläget. Bör läggas till innan skalning.

---

## Bidra

Det här är ett privat projekt. Kontakta projektägaren för access.

Konventioner att följa:
- **Multi-tenant first** — varje DB-query måste ha `organizationId` i WHERE. En query utan det är en säkerhetsbugg.
- **Server before client** — bygg repo-funktion + route, sedan UI.
- **Inga nya npm-paket** utan att motivera i commit-meddelandet.
- **Schema-ändringar** — uppdatera `src/lib/db/schema.ts` och informera om att `npm run db:push` behöver köras. Enum-tillägg kräver råa SQL i Neon.
- Läs `src/app/CLAUDE.md` och `.claude/context/project-state.md` innan en session.
