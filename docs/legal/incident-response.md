# Incident Response Plan

> Vår spelbok när säkerhetsincident inträffar. Måste vara övad minst 1 gång/år.
> Granskas och uppdateras kvartalsvis.

---

## Vad är en "incident"?

Allt som skulle kunna leda till:
- Obehörig åtkomst till persondata
- Datakorruption eller dataförlust
- Längre nedtid (> 30 min)
- Säkerhetshål i kod, infrastruktur eller process
- Brott mot någon kunds DPA

Bedöm **alltid** mot GDPR art. 33: "personuppgiftsincident" = brott mot säkerhet
som leder till oavsiktlig eller olaglig förstöring, förlust, ändring, obehörig
spridning eller åtkomst.

---

## Roller

| Roll | Ansvar | Person |
|---|---|---|
| **Incident Lead** | Driver hela responsen | [Tilldelas vid incident] |
| **DPO** | GDPR-bedömning, IMY-anmälan, kundnotis | [NAMN] |
| **CTO/Tech** | Teknisk utredning, fix | [NAMN] |
| **CEO** | Kund- och PR-kommunikation | [NAMN] |
| **Legal counsel** | Vid behov, kallas in | [ADVOKAT/BYRÅ] |

---

## Faser

### 1. Identifiering (0–1h)

- Vem som helst kan rapportera: `security@mailmind.se` eller direkt till någon i teamet
- Skapa Slack-kanal: `#incident-YYYYMMDD-kort-namn`
- Utse Incident Lead direkt
- Klassificera allvarsgrad:

| Nivå | Definition | Exempel |
|---|---|---|
| **P0** | Datakränkning bekräftad, > 100 påverkade | Obehörig läst andra kunders mejl |
| **P1** | Datakränkning misstänkt | Misstänkt obehörig åtkomstlog |
| **P2** | Säkerhetshål utan känd exploit | Sårbarhet i dependency, uppdaterad |
| **P3** | Process-brott | Anställd glömde MFA i 1 dag |

### 2. Inneslutning (1–4h)

- Roterar relevanta nycklar/credentials direkt
- Stäng av exponerad funktion vid behov
- Isolera berörda system
- Lagra all forensik (loggar, snapshots) — radera INGENTING
- Skicka första-status till alla i incident-kanalen

### 3. Utredning (4–24h)

- Vad inträffade (root cause)?
- När började det? Hur upptäcktes det?
- Vilka data berörda? Vilka kunder/registrerade?
- Är det löst eller pågående?
- Dokumentera tidslinje minut-för-minut

### 4. GDPR-bedömning (inom 72h från upptäckt)

DPO bedömer:
- Är det en "personuppgiftsincident" enligt art. 33? Om JA → IMY-anmälan inom 72h
- Hög risk för registrerade? Om JA → direkt kundnotis enligt art. 34
- Vilka av våra kunders DPA:er kräver notifiering? Standard: 48h

**IMY-anmälan**:
- Via [imy.se/anmal-incident](https://www.imy.se)
- Krävs inom 72h från upptäckt
- Om för sent: motivera fördröjningen
- Kan kompletteras senare med ytterligare info

**Kundnotis** (vid hög risk):
- Klar och tydlig text
- Förklara vad som hänt, vad vi gör, vad de bör göra
- Skicka via e-post + visa banner i appen

### 5. Återställning (varierar)

- Stäng sårbarheten permanent (kod-fix, configuration, etc.)
- Verifiera att inneslutningen håller
- Återställ påverkade tjänster
- Övervaka extra noga 14 dagar framåt

### 6. Post-mortem (inom 5 arbetsdagar)

Skriftlig rapport:
- Tidslinje
- Root cause
- Vad gjorde vi rätt
- Vad gjorde vi fel
- Konkreta åtgärder framåt (med datum + ägare)
- För P0/P1: delas med påverkade kunder

---

## Kontaktmallar

### Första kundnotis (svensk B2B-kund)

> Ämne: [Mailmind säkerhetsnotis — kräver din uppmärksamhet]
>
> Hej,
>
> Vi har upptäckt en säkerhetsincident som påverkar ditt konto hos Mailmind.
> Tidpunkt: [DATUM, TID]. Påverkan: [BESKRIVNING].
>
> Vad vi har gjort:
> - [ÅTGÄRDER]
>
> Vad du bör göra:
> - [REKOMMENDATIONER]
>
> Vi anmäler också detta till IMY enligt GDPR art. 33.
>
> Du kommer få en uppföljande rapport inom 5 arbetsdagar.
>
> Frågor: dpo@mailmind.se
>
> [NAMN], [TITEL]
> Mailmind

### IMY-anmälan (sammanfattning, ska in i deras formulär)

> - Tidpunkt incident: [DATUM]
> - Tidpunkt upptäckt: [DATUM]
> - Beskrivning: [BESKRIVNING]
> - Berörda kategorier: [BESKRIVNING]
> - Uppskattat antal: [SIFFRA]
> - Sannolika konsekvenser: [BESKRIVNING]
> - Vidtagna åtgärder: [LISTA]
> - Kontakt DPO: [NAMN, E-POST]

---

## Övning

- Tabletop-exercise minst 1 gång/år
- Scenario-roterar: ransomware, läckt API-nyckel, insider, sub-processor-läcka
- Dokumenteras i denna mapp under `docs/legal/exercises/`

---

## Loggning

Alla incidenter (även P3) loggas i `docs/legal/incidents/` med:
- YYYYMMDD-namn.md
- Sammanfattning, åtgärder, lärdomar
- Ingen kunddata i filerna
