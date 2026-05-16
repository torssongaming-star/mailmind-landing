# DPIA — Data Protection Impact Assessment

> 🚨 **KRÄVER ADVOKATGRANSKNING.** Detta utkast strukturerar materialet men
> en svensk dataskyddsjurist bör verifiera riskbedömningen innan dokumentet
> betraktas som klart för IMY-granskning.

| | |
|---|---|
| **Version** | 1.0 utkast |
| **Datum** | [DATUM] |
| **DPO/ansvarig** | [NAMN] |
| **Status** | Utkast — kräver advokatgenomgång |
| **Nästa granskning** | Årligen, eller vid betydande förändring av behandling |

---

## 1. Behandlingens art

### 1.1 Sammanfattning
Mailmind är en B2B-SaaS som tar emot kundens supportmejl, använder AI (Claude
Haiku 4.5 via Anthropic API) för att analysera dem, generera svarsförslag och
låter en mänsklig agent godkänna eller redigera innan utskick.

### 1.2 Vad processas
- E-postinnehåll från kundens slutkunder (text, bilagor exkluderade)
- Avsändaridentitet (namn, e-postadress, organisation)
- Trådhistorik
- Audit-loggar
- AI-genererade svar och metadata (confidence, risk level)

### 1.3 Storlek på behandlingen
- Förväntade kunder år 1: 20–50 SMB-företag
- Förväntade mejl/månad per kund: 500–5 000
- Total potentiell datavolym: 100k–250k mejl/månad

---

## 2. Nödvändighet och proportionalitet

### 2.1 Syfte och rättslig grund
- **Syfte (controller)**: kunden använder oss för att leverera kundsupport
- **Rättslig grund (controller → slutkund)**: berättigat intresse (GDPR art. 6.1.f) — kunden ska kommunicera med sina kunder
- **Vår roll**: databehandlare (art. 28)

### 2.2 Datatypsanvändning
| Datakategori | Lagrad | Skickad till AI | Lagrad efter AI-svar |
|---|---|---|---|
| E-postinnehåll | Ja | Ja (Anthropic) | Ja, krypterat |
| Avsändar-namn | Ja | Ja | Ja |
| Avsändar-mejl | Ja | Ja | Ja |
| Trådhistorik | Ja | Ja (upp till 5 senaste trådar) | Ja |
| Bilagor | Nej | Nej | Nej |
| Cookies på slutkund | Nej | Nej | Nej |

### 2.3 Dataminimering
- Bilagor processas INTE
- Anthropic Zero Data Retention är aktiverat — Anthropic loggar inte
- Trådar äldre än 12 månader raderas automatiskt
- Sub-processor-lista visar bara strikt nödvändiga leverantörer

### 2.4 Retention
| Datakategori | Retention | Anledning |
|---|---|---|
| Aktiva tråd-bodies | Obegränsat under avtalstid | Driftsnödvändigt |
| Stängda trådar | 12 månader | Operativ retention |
| Audit-loggar | 24 månader | Säkerhetsutredning |
| Fakturadata (Stripe) | 7 år | Bokföringslagen |
| OAuth-tokens | Tills användare disconnectar | Driftsnödvändigt |

---

## 3. Risker för registrerade

### 3.1 Identifierade risker

| Risk | Sannolikhet | Allvarsgrad | Risknivå |
|---|---|---|---|
| Obehörig åtkomst till mejl-bodies | Låg | Hög | Medel |
| AI-svar innehåller felaktig information | Medel | Medel | Medel |
| Prompt injection via mejl-innehåll | Medel | Låg | Låg |
| Sub-processor-läcka (Anthropic, SendGrid) | Låg | Hög | Medel |
| USA-överföring (Schrems II) | Identifierad | Medel | Medel |
| Insider-missbruk (Mailmind-anställd) | Låg | Hög | Medel |
| Mass-radering vid hack | Låg | Hög | Medel |
| Felaktig multi-tenant-isolering | Mycket låg | Mycket hög | Medel |

### 3.2 Specifika AI-risker
- **Hallucination**: AI fabricerar information om priser/tillgänglighet → mitigerat via system-prompt
- **Prompt injection**: kund försöker manipulera AI:n → mitigerat via `<kund_data>`-tagging
- **Confidence-utvärdering**: AI över-skattar säkerhet → mitigerat via dry-run + auto-send-tröskel 90%

---

## 4. Riskreducerande åtgärder

### 4.1 Tekniska
- AES-256-GCM-kryptering av OAuth-tokens i vila
- TLS 1.2+ för all kommunikation
- Multi-tenant DB-scoping via organizationId i varje query
- Rate limiting på AI-endpoints (60/min/org)
- Audit-loggning av alla state-mutations
- Säkerhetsheaders (CSP, HSTS, X-Frame-Options)
- Webhook-verifiering (HMAC SendGrid, clientState Microsoft)

### 4.2 Organisatoriska
- Rollbaserad åtkomst i appen (owner/admin/member)
- MFA för Mailmind-anställda
- NDAs för alla med åtkomst till kunddata
- Incident Response-plan med 48h-anmälan
- Årlig säkerhetsutbildning

### 4.3 AI-specifika
- Anthropic Zero Data Retention
- Tag-wrapping för kunddata i prompts
- Prompt-injection-detektering (regex-baserad strip)
- Dry-run-tröskel innan auto-send aktiveras
- Confidence ≥ 90% + risk_level=low krav för auto-send
- Mänsklig granskning krävs i standardläge

### 4.4 GDPR-rättigheter
- Dataexport via `/api/app/account/export` (art. 20)
- Radering via `/api/app/account/delete` med 30 dagars grace (art. 17)
- Rättelse via tjänstens UI (art. 16)
- Tillgång via dataexport (art. 15)
- Begränsning via blocklist + disconnect

---

## 5. Restrisk

Efter mitigeringar bedöms restrisken som **låg-medel**. Behandlingen är
proportionerlig i förhållande till syftet (förbättra kundsupport-effektivitet)
och de tekniska åtgärderna är på branschstandard eller över.

---

## 6. Förhandssamråd med IMY

🚨 [ADVOKATFRÅGA] Krävs förhandssamråd enligt GDPR art. 36? Bedömningen:
- Hög risk efter mitigering: **Nej**
- Storskalig behandling: gränsfall
- Innovativ teknik (AI): **Ja, men flertal andra SaaS gör samma**

Förslag: ingen art. 36-anmälan, men dokumentera bedömningen.

---

## 7. Förändringshantering

- DPIA omprövas årligen
- Vid större förändringar (ny AI-modell, ny sub-processor, nytt land):
  ompröva inom 30 dagar
- Loggas i `docs/legal/CHANGELOG.md`
