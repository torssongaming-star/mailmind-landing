# TOMs — Tekniska och organisatoriska åtgärder

> Bilaga till varje DPA. Beskriver konkret hur vi skyddar persondata.
> Uppdateras när säkerhetsåtgärder förändras.

---

## 1. Konfidentialitet

### 1.1 Åtkomstkontroll
- Rollbaserad åtkomst i appen: owner / admin / member
- Multi-factor authentication för administratörer (via Clerk)
- Multi-tenant DB-scoping: alla queries innehåller `organizationId`-filter
- Anställda har separata personliga konton (ej delade)
- Just-in-time-access för produktionsdata, loggat

### 1.2 Pseudonymisering & kryptering
- AES-256-GCM för OAuth-tokens i vila
- TLS 1.2+ för all extern trafik
- Databasen krypterad i vila (AWS RDS)
- Backups krypterade
- PII maskeras i loggar (emails, UUIDs, Bearer-tokens)

### 1.3 Konfidentialitetsförklaring
- NDA i anställningsavtal
- Separat NDA för konsulter
- Brott mot konfidentialitet är uppsägningsgrund

---

## 2. Integritet

### 2.1 Indatakontroll
- Zod-schema-validering på alla API-endpoints
- HMAC-verifiering på inkommande webhooks (SendGrid, Stripe)
- clientState-verifiering på Microsoft Graph
- CSRF-skydd via SameSite cookies

### 2.2 Utdatakontroll
- Audit-loggar för alla state-mutations (24 mån retention)
- Logging via strukturerad logger med PII-maskning
- Inga PII i front-end-fel eller browser-loggar

### 2.3 Förändringskontroll
- Git-versionerad kod, PR-review innan merge till main
- TypeScript-typecheck + linting blockerar trasig kod
- Production-build verifierar varje deploy
- Vitest-tester för kritiska helpers

---

## 3. Tillgänglighet

### 3.1 Backuper
- Dagliga, automatiska, krypterade
- 30 dagars retention
- Point-in-time recovery senaste 7 dagar (Neon)
- Restore-test minst kvartalsvis

### 3.2 Redundans
- Multi-AZ databas (Neon Frankfurt)
- Edge-distribuerade statiska tillgångar (Vercel)
- Stateless serverless functions

### 3.3 SLA
- Se publicerad SLA på `/legal/sla`
- 99.5–99.95% beroende på plan
- RPO < 1h, RTO < 4h

---

## 4. Motståndskraft

### 4.1 Rate limiting
- Per-IP / per-org / per-user på AI, webhooks, push, invites
- Tokenbucket-baserat, max 60/min för AI-generering

### 4.2 DDoS
- Vercel WAF + Edge-distribution
- Cloudflare på domännivå (planerat)

### 4.3 Säkerhetsheaders
- Content-Security-Policy
- Strict-Transport-Security (HSTS)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY (utom /addins/* för Outlook)
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera/microphone/geolocation off

---

## 5. Återställning

### 5.1 Incident response
- Dokumenterad spelbok (se `incident-response.md`)
- Övning minst 1 gång/år
- DPO + tekniskt ansvarig + executive på callkedja

### 5.2 Anmälningsplikt
- GDPR art. 33: IMY inom 72h
- GDPR art. 34: registrerade vid hög risk
- DPA: kund inom 48h

---

## 6. Pseudonymisering

- E-postadresser pseudonymiseras i loggar (`k***@bolag.se`)
- UUIDs maskeras i loggar (`7a1c…2345`)
- Bearer-tokens maskeras i loggar
- PII tas bort från error-tracking innan rapportering

---

## 7. Regelbunden testning

- Production build verifieras vid varje deploy
- 27+ enhetstester för säkerhetshelpers
- TypeScript strict mode aktiverat
- Penetrationstest planerat årligen från [ÅR]

---

## 8. Underbiträden

Per `/legal/sub-processors`. Varje med:
- Skriftligt DPA
- TIA dokumenterad
- SCC vid tredjelandsöverföring

---

## 9. Personal

- NDA i anställningsavtal
- Begränsad åtkomst till produktionsdata (need-to-know)
- Avslutsrutin tar bort all åtkomst inom 24h
- Säkerhetsutbildning vid onboarding + årligen
