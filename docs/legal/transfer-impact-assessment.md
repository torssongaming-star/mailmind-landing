# Transfer Impact Assessment (TIA)

> 🚨 **KRÄVER ADVOKATGRANSKNING** för varje leverantör i tredjeland.
> Schrems II-rättsläge kräver att vi bedömer om SCC räcker för varje
> överföring, eller om vi behöver tilläggsåtgärder.

| | |
|---|---|
| **Version** | 1.0 utkast |
| **Datum** | [DATUM] |
| **Ansvarig** | [DPO] |
| **Granskningsfrekvens** | Vid varje ny leverantör + årligen |

---

## Metodologi

Per leverantör utvärderar vi:

1. **Vilken data** överförs?
2. **Vart** överförs den (land + region)?
3. **Vilka lagar** i mottagarlandet kan kräva ut data (FISA 702, CLOUD Act etc.)?
4. **Vilken sannolikhet** att leverantören faktiskt får sådan begäran?
5. **Vilka tilläggsåtgärder** behövs (kryptering, pseudonymisering, åtkomstkontroll)?
6. **Slutbedömning**: tillräckligt skydd? Om nej — kan vi byta leverantör eller datalokalisera?

---

## Per-leverantör

### Anthropic (USA, CA)

| Fält | Värde |
|---|---|
| Data | Mejl-innehåll, kontext, persondata i texten |
| Region | USA (Kalifornien) |
| Relevant lag | FISA 702, EO 12333, CLOUD Act |
| Sannolikhet riktad begäran | Låg (vi är inte stor target) |
| Sannolikhet bulk-begäran | Medel — FISA 702 kan kräva ut data från US-baserade providers |
| Tilläggsåtgärder | (1) Anthropic Zero Data Retention aktiverat — Anthropic raderar input direkt efter response (2) Endast nödvändig kontext skickas (3) Anthropic är DPF-certifierad |
| **Slutbedömning** | 🟡 **Acceptabelt** — Zero Retention + DPF + SCC = tillräckligt |
| Granskat | [DATUM] av [NAMN] |

### Stripe (USA + IE)

| Fält | Värde |
|---|---|
| Data | Kontonamn, e-post, betalkort (token), abonnemangsdata |
| Region | USA + Irland |
| Relevant lag | FISA 702 |
| Sannolikhet riktad begäran | Låg |
| Tilläggsåtgärder | (1) Stripe är DPF-certifierad (2) Betalkort tokeniseras — vi får aldrig rådata (3) Stripes DPA signerad |
| **Slutbedömning** | 🟢 **Acceptabelt** |
| Granskat | [DATUM] av [NAMN] |

### Clerk (USA, NY)

| Fält | Värde |
|---|---|
| Data | Användares e-post, namn, OAuth-tokens, sessioner |
| Region | USA |
| Relevant lag | FISA 702 |
| Tilläggsåtgärder | (1) Clerk DPF-certifierad (2) Sessions kortlivade (3) MFA tillgängligt |
| **Slutbedömning** | 🟡 **Acceptabelt** — överväg uppgradering till EU-region när kund-volymen ökar |
| Granskat | [DATUM] |

### SendGrid / Twilio (USA, CA)

| Fält | Värde |
|---|---|
| Data | Inkommande mejl-innehåll, mottagaradress |
| Region | USA |
| Relevant lag | FISA 702, CLOUD Act |
| Tilläggsåtgärder | (1) DPF-certifierad (2) HMAC-verifiering på vår sida (3) Endast som relay — vi lagrar inte hos SendGrid |
| **Slutbedömning** | 🟡 **Acceptabelt** med övervakning. Alternativ: EU-baserad inbound parse-tjänst om volym växer |
| Granskat | [DATUM] |

### Resend (USA + EU)

| Fält | Värde |
|---|---|
| Data | Utgående mejl-innehåll, mottagaradress |
| Region | USA + EU (kan väljas) |
| Relevant lag | FISA 702 om USA-region |
| Tilläggsåtgärder | (1) DPF-certifierad (2) Resend tillåter EU-region — välj denna när möjligt |
| **Slutbedömning** | 🟢 **Acceptabelt** — välj EU-region i konsoll |
| Granskat | [DATUM] |

### Vercel (USA + EU edge)

| Fält | Värde |
|---|---|
| Data | Request-logs, IP, performance-metrik |
| Region | EU edge för EU-användare; USA för admin/analytics |
| Relevant lag | FISA 702 (admin endast) |
| Tilläggsåtgärder | (1) DPF-certifierad (2) Edge tjänar EU från EU-regioner |
| **Slutbedömning** | 🟢 **Acceptabelt** |
| Granskat | [DATUM] |

### Neon (EU — Frankfurt)

| Fält | Värde |
|---|---|
| Data | All applikationsdata |
| Region | EU — Frankfurt (AWS eu-central-1) |
| Relevant lag | GDPR (intern), AWS US Cloud Act för support |
| Tilläggsåtgärder | (1) Neon SaaS-ansvarig i EU (2) AWS European Sovereign Cloud när tillgängligt |
| **Slutbedömning** | 🟢 **EU-intern överföring** |
| Granskat | [DATUM] |

### Google (Globalt)

| Fält | Värde |
|---|---|
| Data | OAuth-tokens, mejl-innehåll (vid Gmail-koppling) |
| Region | Globalt |
| Relevant lag | FISA 702, CLOUD Act |
| Tilläggsåtgärder | (1) DPF-certifierad (2) OAuth-tokens AES-256-krypterade hos oss (3) Kunden initierar OAuth-flödet aktivt |
| **Slutbedömning** | 🟡 **Acceptabelt** — kundens val att koppla Gmail |
| Granskat | [DATUM] |

### Microsoft (EU + USA)

| Fält | Värde |
|---|---|
| Data | OAuth-tokens, mejl-innehåll, subscription notifs |
| Region | EU + USA (Microsoft regioner) |
| Relevant lag | CLOUD Act |
| Tilläggsåtgärder | (1) Microsoft EU Data Boundary för EU-tenants (2) OAuth-tokens krypterade hos oss (3) clientState-verifiering på webhooks |
| **Slutbedömning** | 🟢 **Acceptabelt** för EU-tenants |
| Granskat | [DATUM] |

---

## Övervakning

- Granska årligen
- Vid nya US-lagstiftningar (FISA-reformer etc.): omgranskning
- Vid byte av leverantör: ny TIA krävs
