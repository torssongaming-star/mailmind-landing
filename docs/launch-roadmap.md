# Launch-roadmap — utan jurist & utan AB i början

> Pragmatisk plan för att komma ut till första betalande kund.
> Snitt-tid: 4 veckor. Snitt-kostnad: ~30 000 kr (varav 25k är aktiekapital ni behåller).

## Status

| Steg | Status | Datum |
|---|---|---|
| E-postaliasar uppsatta | ✅ klar | [DATUM] |
| Anthropic Zero Data Retention signerad | ⏳ kvar | — |
| DPF-status verifierad hos leverantörer | ⏳ kvar | — |
| LegalFooter på landing | ⏳ kvar | — |
| Placeholders ersatta ("under bolagsbildning") | ⏳ kvar | — |
| AB-bildning via verksamt.se | ⏳ kvar | — |
| F-skatt + moms registrerat | ⏳ kvar | — |
| Företagskonto öppnat | ⏳ kvar | — |
| Placeholders → riktiga bolagsuppgifter | ⏳ kvar | — |
| Stripe live mode aktiverat | ⏳ kvar | — |
| Första betalande kund | ⏳ kvar | — |

---

## Filosofi

**Du kan inte sluta riktiga avtal utan ett bolag.** Som privatperson eller enskild
firma har du personligt obegränsat ansvar för dataläckor. En enda GDPR-bot kan
kosta hela sparkapitalet. Därför:

```
Closed beta (gratis) → bilda AB → första betalda kund
   ↑ pågående             ↑ vecka 2     ↑ vecka 4
```

---

## Vecka 1 — Idag (kostnad: 0 kr)

### 1.1 E-postadresser ✅
Skapa via Loopia/DNS:
- `hej@mailmind.se`
- `support@mailmind.se`
- `dpo@mailmind.se`
- `security@mailmind.se`
- `abuse@mailmind.se`
- `billing@mailmind.se`
- `enterprise@mailmind.se`

Forwarda alla till befintlig inkorg.

### 1.2 Anthropic Zero Data Retention
URL: https://console.anthropic.com/settings/data-retention

Fyll i formuläret. Helt gratis. Eliminerar att Anthropic loggar era kunders mejl.

### 1.3 Verifiera DPF-status hos USA-leverantörer
Logga in på varje, screenshot:
- Stripe → Privacy Center
- Clerk → Trust Center
- Vercel → Trust Center
- Resend → Privacy Page
- SendGrid (Twilio) → Trust Center

Spara skärmdumpar i `docs/legal/evidence/`.

### 1.4 Ersätt placeholders temporärt i kod
Sök & ersätt `[BOLAGSNAMN AB]` → `Mailmind (under bolagsbildning)`.

### 1.5 Lägg LegalFooter på landing-sidan
Importera `LegalFooter` i `src/app/page.tsx` så org-uppgifter + alla policy-länkar syns.

---

## Vecka 1-2 — Closed beta (kostnad: 0 kr)

Hitta 3-5 utvalda företag. Erbjud **gratis** mot:
- Feedback
- Skriftligt godkännande att de använder verktyget "i beta, på egen risk"
- Möjlighet att bli case study senare

**Mejl-mall till prospects:**

> Hej [namn],
>
> Vi släpper Mailmind i closed beta och letar efter 3-5 företag som vill prova
> gratis i utbyte mot feedback. Det är en AI-tjänst som hjälper er triagera och
> svara på kundsupport-mejl.
>
> Tjänsten är i beta och tillhandahålls "som den är" — ni ansvarar själva för
> att den passar er användning och GDPR-mässigt för era kundmejl. När vi går
> live (om ca en månad) får ni 50% rabatt första året.
>
> Intresserad?
>
> /[ditt namn]

---

## Vecka 2 — AB-bildning (kostnad: 27 200 kr varav 25k är ditt aktiekapital)

### 2.1 verksamt.se → "Starta aktiebolag"
- Bolagsnamn (kolla ledighet på bolagsverket.se)
- VD = du
- Styrelse = du (1 person räcker)
- SNI-kod: **62.010** (datakonsultverksamhet) eller **63.110** (databehandling)
- Bolagsverket-avgift: **2 200 kr**

### 2.2 Aktiekapital: 25 000 kr
- Skapa bolagskonto (kan göras parallellt)
- Sätt in 25 000 kr
- Bank intygar via Bolagsverket
- Pengarna är inte borta — de är bolagets, kan lånas ut till bolaget eller spenderas på utrustning direkt

### 2.3 Vänta 5-10 dagar
Du får org-nr.

---

## Vecka 3 — Efter AB är klart (kostnad: 0 kr)

### 3.1 Anmäl till Skatteverket (gratis)
- F-skatt
- Moms (för B2B drar du moms — krävs)
- Arbetsgivarregister (om du tar ut lön)

### 3.2 Företagskonto
SEB, Handelsbanken, Avanza Business — alla har gratis-paket för småbolag.

### 3.3 Beställ digital BankID för bolaget

### 3.4 Ersätt placeholders i kod
Sök & ersätt:
- `[BOLAGSNAMN AB]` → ditt nya bolagsnamn
- `[XXXXXX-XXXX]` → org-nr
- `[ADRESS]` → bolagsadress
- `[DATUM]` → dagens datum
- `[STAD]` → stad

Push till Vercel.

### 3.5 Bestäm tvistlösning i kod
I `/terms` §15 och `/legal/dpa` §10:
- **Stockholms tingsrätt** (billigare, offentlig) ELLER
- **Skiljedom enligt SCC** (snabbare, sluten, dyrare per tvist)

För svensk SMB B2B är **tingsrätt rekommenderat** — billigare och bra nog.

---

## Vecka 4 — Första betalande kund (kostnad: ~2 900 kr Stripe-setup)

### 4.1 Stripe → live mode
- Lägg till live keys i Vercel env
- Registrera live webhook i Stripe → `https://mailmind.se/api/webhooks/stripe`
- Verifiera testorder

### 4.2 SendGrid Inbound Parse-MX
MX för `mail.mailmind.se` → `mx.sendgrid.net` prio 10 i Loopia.

### 4.3 Första betalda kund
**Små kunder (~500-2000 kr/månad):**
> "Vi har en standardplattform med standardvillkor. Här är vår Privacy Policy +
> Användarvillkor + AUP. Klicka-igenom räcker."

**Mellanstora (~5000+ kr/månad) som begär DPA:**
> "Vi har en DPA-mall. Skicka över ert juridiska teams kommentarer så signerar vi
> vår version."
=
Kunden bär kostnaden för granskning, inte du.

**Enterprise (~20 000+ kr/månad):**
= Investera i advokattid (5-10k SEK), motiveras av kontraktets värde.

---

## När du MÅSTE ringa advokaten

- Kund kräver eget förhandlat DPA med specifika klausuler
- Term sheet vid finansiering
- Enterprise-kund (>50 000 kr/månad)
- Rättstvist eller IMY-klagomål
- Bolagsförsäljning

Budget: ~10-30 000 kr per gång. Sällan mer än 1-2 gånger första året.

---

## Genvägar för icke-kritisk juridik

| Tjänst | Kostnad | Vad du får |
|---|---|---|
| **Iubenda Pro** | ~3 000 kr/år | Auto-genererad + uppdaterad Privacy + Cookies + DPA |
| **Termly** | ~110 kr/mån | Samma, billigare |
| **GDPR.eu** | gratis | Statiska mallar |

Rekommendation: **Iubenda Pro** för Privacy + Cookies + grund-DPA + skipa MSA tills första enterprise-kund.

---

## Kontaktinformation att samla in vid bolagsbildning

Förbered:
- [ ] Bolagsnamn (alternativ 1, 2, 3 — Bolagsverket kan avvisa)
- [ ] SNI-kod (62.010 eller 63.110)
- [ ] Säte (kommun)
- [ ] Aktiekapital (25 000 kr)
- [ ] Räkenskapsår (kalenderår enklast)
- [ ] Verksamhetsbeskrivning (1-2 meningar: "AI-driven kundtjänst-SaaS")
- [ ] Styrelse + VD (du)
- [ ] Revisor: ej obligatoriskt under tröskelvärden
