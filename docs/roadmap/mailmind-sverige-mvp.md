# Mailmind Sverige MVP — Roadmap & Låsta Beslut

> Denna fil är strategisk single source of truth för marknad, GTM och produktprioriteringar.
> Läs den i nystart av session. Om koden eller annat dokumentation avviker från denna fil — flagga avvikelsen.
> Uppdateras av produktägaren, inte av agenter autonomt.

---

## Låsta beslut

Dessa beslut är fattade och ska inte omförhandlas utan explicit instruktion från produktägaren.

### 1. Marknad: Sverige först

**Beslut:** Första marknad är Sverige. Ingen internationell expansion under MVP-fasen.

**Motivering:**
- Produktägaren och teamet är baserade i Sverige och har lokala kundkontakter.
- Svensk SMB har ett tydligt behov av AI-assisterad e-posthantering utan Zendesk-komplexitet.
- Lokalt nätverk möjliggör assisterad onboarding utan hög CAC.

**Vad det innebär operativt:**
- UI och kommunikation primärt på svenska.
- AI-inställningar defaultar till svenska (`language: sv`).
- Prisättning i EUR (vanlig i Sverige för SaaS).
- GDPR-efterlevnad krävs från dag ett — Neon EU Central (Frankfurt) är valt av den anledningen.

---

### 2. Go-to-market: Demo-led SaaS med assisterad onboarding

**Beslut:** Varje ny kund onboardas med mänsklig kontakt från Mailmind-teamet. Ingen ren self-serve i MVP.

**Motivering:**
- Tidiga kunder behöver hjälp att konfigurera case types, AI-ton och inbox-forwarding.
- Personlig onboarding ger hög aktivering och snabb feedback.
- Self-serve kan läggas till senare när onboarding-flödet är bevisat och dokumenterat.

**Vad det innebär operativt:**
- Varje ny signup följs upp av Mailmind-teamet inom 24h.
- Admin onboarding console (se avsnitt 6) är ett verktyg för teamet att provisionera kunder korrekt.
- Inga automatiska välkomstmejl som ersätter mänsklig kontakt i MVP.

---

### 3. Segment: Generell SMB

**Beslut:** Målgruppen är generell SMB (5–50 anställda), inte en specifik vertikal.

**Motivering:**
- Bredare adresserbar marknad under validering.
- AI-triagen är branschoberoende — case types konfigureras per kund.
- Nischning till specifik vertikal skjuts upp tills vi ser var aktiveringen är högst.

---

### 4. Integration: Microsoft 365 / Outlook först

**Beslut:** Outlook-tillägget är primär integrationsyta. Gmail och IMAP är uppskjutna.

**Motivering:**
- Svensk SMB kör primärt Microsoft 365.
- Outlook-tillägget (taskpane) möjliggör demo direkt i kundens befintliga miljö.
- Forwarding-modellen (`<slug>@mail.mailmind.se`) fungerar med alla e-postklienter utan OAuth.

**Vad som är byggt:**
- Outlook-tillägg: `public/addins/outlook/manifest.xml` + `src/app/addins/outlook/`
- Taskpane med Clerk-auth, Office.js-integration och "Triage detta mejl"-knapp
- Forwarding-guide i inboxes-UI

**Uppskjutet:**
- Gmail OAuth-connector
- IMAP-connector

---

### 5. AI-autosvar — beslutsregler

**Beslut:** Automatiska svar (utan mänsklig granskning) får **endast** skickas när samtliga fyra villkor är uppfyllda:

| # | Villkor | Förklaring |
|---|---------|------------|
| 1 | **Confidence ≥ 90 %** | AI-modellen returnerar ett konfidenstal; under 90 % krävs mänsklig granskning |
| 2 | **Källgrundat svar** | Svaret ska kunna spåras till en källa i knowledge base eller trådhistorik — inga hallucinerande svar |
| 3 | **Risknivå = låg** | Eskalering, juridiska frågor, klagomål, kunder med historia av tvister → alltid till mänsklig granskning |
| 4 | **Inga blockeringsskäl** | Ny kund (< 3 interaktioner), känslig kategori, markerat som VIP, manuellt blockerad → kräver granskning |

**Alla fyra måste vara uppfyllda.** Ett enda missat villkor → draft hamnar i granskningskön.

**Implementationsnot:** Logiken ska ligga i `src/lib/app/autoTriage.ts` och vara testbar isolerat från sendning.

---

### 6. Dry-run — krav före aktivering av autosvar

**Beslut:** Dry-run-läge ska vara aktiverat och verifierat per organisation innan autosvar aktiveras.

**Vad dry-run innebär:**
- AI genererar draft och loggar vad som *hade* skickats.
- Inget mejl skickas till kunden.
- Agenten kan granska dry-run-loggen och bekräfta att kvaliteten håller.

**Krav:**
- Minst 20 dry-run-iterationer med godkänd kvalitet innan autosvar aktiveras för en organisation.
- Aktivering sker manuellt av Mailmind-teamet via admin console (se avsnitt 7) — inte av kunden själv i MVP.

---

### 7. Admin onboarding console — hög prioritet

**Beslut:** En intern vy för Mailmind-teamet att provisionera och konfigurera nya kundkonton är **hög prioritet** för nästa fas.

**Motivering:**
- Assisterad onboarding (beslut 2) kräver att vi kan sätta upp kunder snabbt och korrekt utan manuell SQL.
- Idag kräver ny kund: manuell SQL för subscription + license_entitlements + case types.
- Det är inte skalbart och ökar risken för fel i produktionsdatabasen.

**Vad konsolen ska kunna göra (MVP):**
- Skapa ny kund: org + användare + trial-subscription med ett klick
- Sätta plan och entitlements utan SQL
- Konfigurera standard case types från mall
- Aktivera / inaktivera dry-run per org
- Visa org-hälsa: antal trådar, AI-användning, senaste aktivitet

**Placering:** `/admin` (redan skyddad route) — bygg vidare på befintlig admin-layout.

---

## Fasplan

### Genomfört (fas 1–5)

| Fas | Innehåll |
|-----|----------|
| 1 | Auth, org-provisioning, entitlements, usage, onboarding |
| 2 | AI-drafts, thread-schema, inbox-UI |
| 3 | Draft-actions (edit/send/reject), settings UI, Resend-integration |
| 4 | SendGrid Inbound Parse, auto-triage, inboxes-UI, Stripe-hardening |
| 4.5–4.7 | Reply-headers, activity-vy, Clerk webhook, trial-onboarding, prompt caching, stats, bulk-actions |
| 5 | Internal notes, reply templates, webhook-idempotency |
| Underhåll | ESLint-fix (MAI-5 ✅), build-verifiering (MAI-6 pågår) |

---

### Nordenfas — fokus tills produkten är bevisad

Målet är en fullt fungerande produkt som kan demos och säljas till svenska/nordiska SMB-kunder. EU-compliance, trust layer och vertikala paket prioriteras *efter* att vi har betalande pilotkunder.

#### Fas 6 — Pilot-ready (pågående)

Dessa måste vara klara innan första kundpilot:

| # | Task | Status | Blocker för |
|---|------|--------|-------------|
| 6a | **Admin onboarding console** | 🔲 Nästa | Assisterad onboarding utan manuell SQL |
| 6b | **Outlook-tillägg: sideload-guide + testning** | 🔲 | Demo-momentet i säljmötet |
| 6c | **Dry-run-pipeline** | 🔲 | Krav innan autosvar aktiveras |
| 6d | **Autosvar-pipeline** | 🔲 | Kärnvärdet i produkten |
| 6e | **Stripe live-keys + Resend domain auth** | 🔲 | Kunna ta betalt och skicka från rätt domän |

#### Fas 7 — Nordisk expansion

Bra att ha, prioriteras efter att fas 6 är klar:

| # | Task | Motivering |
|---|------|------------|
| 7a | **Evidenslänkade AI-svar** | Visar källan bakom varje draft — ökar förtroende |
| 7b | **ROI-dashboard** | Gör det lättare att sälja vidare och förnya avtal |
| 7c | **Google Workspace / Gmail-connector** | Breddar reach i Norden efter M365 |

---

### Parkerat — aktiveras när produkten är bevisad

Dessa är strategiskt viktiga för Europa men ska inte påverka Norden-fasen:

- EEA-only mode / regionpinning
- PII-redaction före LLM-anrop
- Retention controls / DSAR-export
- Maskinläsbar audit-export
- DPA-pack, AI use policy, SOC 2-plan
- Vertikala paket (e-handel, juridik)
- Lokalisering bortom sv/en
- Ny prissättningsmodell (hybridmodell med compliance-tillägg)
- Multi-tenant customer domains
- Self-serve onboarding utan mänsklig kontakt
