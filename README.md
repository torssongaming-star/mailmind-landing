# Mailmind — AI-driven e-postsupport & Offertverktyg för svenska SMB

Mailmind är en svensk B2B SaaS-plattform som hjälper svenska SMB-företag (5–50 anställda) att hantera inkommande kundmejl mer effektivt, utan att behöva implementera tunga system som Zendesk. Utöver kärnan för e-postsupport erbjuder Mailmind numera även ett integrerat **Offertverktyg (Solar)** som en tilläggstjänst.

Kunden kopplar sitt Gmail-konto via OAuth **eller** vidarebefordrar sin supportinkorg till en unik `<slug>@mail.mailmind.se`-adress. AI:n klassificerar mejlet, skriver ett utkast till svar och presenterar det för agenten — som granskar och skickar med ett klick. 

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
10. [Offertverktyg (Solar) - Tilläggstjänst](#offertverktyg-solar---tilläggstjänst)
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
             │  Inbox   │  │ Offerter│  │ Inställ-    │
             │(AI-mejl) │  │ (Solar) │  │ ningar      │
             └──────────┘  └─────────┘  └─────────────┘

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
| ORM | Drizzle ORM | Schema i `src/lib/db/schema.ts` |
| Billing | Stripe | Checkout + portal + webhooks |
| Inbound mail | Gmail API (Pub/Sub) + SendGrid | |
| Outbound mail | Gmail API (Gmail-anslutna inkorgar) + Resend | |
| AI | Anthropic SDK — `claude-haiku` | Prompt caching aktiverat |
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
│   │   ├── inbox/             # Split-panel inkorg
│   │   ├── solar/             # Offertverktyget (Tilläggstjänst)
│   │   ├── settings/          # Inställningar (sidebar-nav)
│   │   ├── dashboard/billing/ # Fakturering och tilläggstjänster
│   │   ├── inboxes/           # Koppla inkorgar
│   │   └── stats/             # Stats-dashboard (recharts)
│   ├── (admin)/admin/         # Intern admin-panel
│   ├── api/                   # API-rutter & webhooks
├── lib/
│   ├── app/                   # Business logic (AI, Entitlements, AutoSend)
│   ├── db/                    # Drizzle schema, queries
│   └── plans.ts               # Prenumerationsplaner & tillägg
└── components/
    ├── portal/                # UI-komponenter för portalen (Sidebar etc)
    └── ui/                    # Delade UI-komponenter
```

---

## Flöden

### Inkommande mejl (Gmail OAuth-väg)

```
1. Gmail tar emot mejl
2. Google Pub/Sub push → POST /api/webhooks/gmail/push
3. Webhook:
   ... [Hämtar mejl via Gmail API] ...
   g. Fire-and-forget: autoTriageNewMessage()

4. autoTriageNewMessage():
   ... [Klassificerar och genererar AI-svar baserat på KB] ...
   e. Sparar draft med status "pending"
   f. canAutoSend()? → executeSendDraft() (skickar via Gmail API)
```

### Manuellt svar (agent)

```
Agent öppnar tråd → klickar "Generera svar"
→ AI genererar draft → Agent redigerar → Godkänner → Skickas
```

---

## Offertverktyg (Solar) - Tilläggstjänst

Förutom den huvudsakliga e-posttriageringen innehåller plattformen nu ett modulärt **Offertverktyg**. 
- **Pris & Tillgänglighet:** Verktyget kostar 199 kr/mån och kräver minst en Starter-plan för att kunna aktiveras. På Enterprise-planen ingår verktyget.
- **Åtkomst:** Om kunden har aktiverat tillägget dyker en "Offerter"-flik upp i sidomenyn (`Sidebar`). Access styrs via `hasProductAccess(account, "solar")`.
- **Fakturering:** Aktivering och status för tillägget hanteras smidigt på Faktureringssidan (`/dashboard/billing`) där det ligger i en egen sektion för "Tilläggstjänster".

---

## Miljövariabler

Skapa `.env.local` baserat på `.env.example`.

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
RESEND_API_KEY=re_...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GMAIL_TOKEN_ENCRYPTION_KEY=<64 hex-tecken>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Lokal utveckling

```bash
# 1. Installera beroenden
npm install

# 2. Miljövariabler
cp .env.example .env.local

# 3. Synka databas-schema
npm run db:push

# 4. Starta dev-server
npm run dev
```

---

## Databas

Schema-källfil: `src/lib/db/schema.ts`

Huvudtabeller:
- `organizations`, `users`, `inboxes`
- `email_threads`, `email_messages`, `ai_drafts`
- `org_product_access` (Styr tillgång till tilläggstjänster som Solar)
- `case_types`, `knowledge_entries`, `reply_templates`
- `ai_settings`, `usage_counters`, `audit_logs`

---

## Gmail OAuth-integration

Gmail OAuth-tokens lagras AES-256-GCM-krypterade i `inboxes.config`. Nyckeln (`GMAIL_TOKEN_ENCRYPTION_KEY`) är en 32-byte hex-sträng och får aldrig loggas eller checkas in.

---

## AI-pipeline & Autosvar

- **Modell:** `claude-haiku-4-5-20251001` (med prompt caching)
- Systemprompten inkluderar organisationens ton, ärendetyper, kunskapsbas och trådhistorik.
- **Autosvar:** Hårt låst bakom hög konfidens (>= 0.90), låg risknivå och minst 20 godkända dry-run iterationer.

---

## Kända begränsningar

- **Inget test-suite** — introducera inte ett utan att diskutera med projektägaren.
- **Outlook/Microsoft 365** — inte implementerat ännu. Är ett låst beslut som prioriteras i nästa iteration.
- **SendGrid Inbound Parse** — Tillfällig lösning tills trafikvolymen motiverar dedikerad infrastruktur.
- **Juridiska sidor** — `terms` och `privacy` är platshållare i dagsläget.

---

## Bidra

Följ dessa konventioner:
- **Multi-tenant first** — varje DB-query måste ha `organizationId` i WHERE. En query utan det är en säkerhetsbugg.
- Läs `.claude/context/project-state.md` innan en session.
