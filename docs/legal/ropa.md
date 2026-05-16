# ROPA — Records of Processing Activities

> Krävs av GDPR art. 30. Internt register som ska kunna visas för IMY på begäran.

| | |
|---|---|
| **Version** | 1.0 |
| **Senast uppdaterad** | [DATUM] |
| **Ägare** | [DPO/säkerhetsansvarig] |

---

## A. Behandling som controller — Mailminds egen behandling

### A1. Användaradministration

| Fält | Värde |
|---|---|
| Behandlingens namn | Mailmind-användarkonton |
| Syfte | Tillhandahålla SaaS-tjänsten, hantera inloggning, fakturering |
| Rättslig grund | Avtal (GDPR art. 6.1.b) |
| Kategorier registrerade | Mailminds kunder (B2B-användare) |
| Kategorier persondata | Namn, e-post, organisationsnamn, betalningsdata (Stripe) |
| Mottagare | Clerk (auth), Stripe (betalning), Vercel (hosting), Neon (DB) |
| Tredjelandsöverföring | USA — SCC + DPF |
| Retention | Tills konto raderas + 30 dgr grace + 7 år för fakturadata |
| Säkerhetsåtgärder | Se TOMs |

### A2. Webbanalys

| Fält | Värde |
|---|---|
| Behandlingens namn | Anonym webbanalys |
| Syfte | Förbättra mailmind.se |
| Rättslig grund | Samtycke (GDPR art. 6.1.a) — via cookie-banner |
| Kategorier registrerade | Besökare till mailmind.se |
| Kategorier persondata | Anonyma sid-visningar, ingen IP, ingen persistent identifierare |
| Mottagare | Vercel Analytics |
| Tredjelandsöverföring | USA — SCC + DPF |
| Retention | 24 månader |

### A3. Demo-förfrågningar

| Fält | Värde |
|---|---|
| Behandlingens namn | Demo-/kontaktformulär |
| Syfte | Svara på prospect-förfrågningar |
| Rättslig grund | Berättigat intresse (art. 6.1.f) |
| Kategorier persondata | Namn, e-post, företag, fritext |
| Mottagare | Mailmind-team (internt) |
| Retention | 12 månader om inget avtal ingås |

---

## B. Behandling som processor — för våra kunder

### B1. Kundsupport-mejl (huvudtjänsten)

| Fält | Värde |
|---|---|
| Controller | Mailminds B2B-kund |
| Syfte | Triagera, kategorisera och svara på controllerens kundmejl |
| Rättslig grund (controller) | Beror — vanligen berättigat intresse (art. 6.1.f) |
| Kategorier registrerade | Controllerens slutkunder, intressenter, leverantörer |
| Kategorier persondata | E-postinnehåll, namn, e-post, metadata |
| Underbiträden | Anthropic (AI), SendGrid (inbound), Resend (outbound), Gmail, Microsoft Graph, Neon (DB), Vercel (hosting) |
| Tredjelandsöverföring | USA — SCC + DPF + Anthropic Zero Retention |
| Retention | 12 mån för stängda trådar, obegränsat för aktiva (under avtalstid) |
| Säkerhetsåtgärder | Se TOMs, multi-tenant scoping, kryptering |

### B2. Teammedlemmar hos kund

| Fält | Värde |
|---|---|
| Controller | Mailminds B2B-kund |
| Syfte | Möjliggöra inloggning för controllerens anställda |
| Kategorier registrerade | Anställda hos controller |
| Kategorier persondata | Namn, e-post, roll, OAuth-tokens (om Gmail/Outlook kopplad) |
| Retention | Tills inbjudan återkallas eller konto avregistreras |

---

## Underhåll

- Uppdatera vid varje ny funktion som behandlar persondata
- Granskas årligen
- Vid begäran från IMY: leverera inom 5 arbetsdagar
