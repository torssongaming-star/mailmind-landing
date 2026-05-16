import type { Metadata } from "next";
import { LegalNotice } from "../LegalNotice";

export const metadata: Metadata = { title: "Personuppgiftsbiträdesavtal (DPA)" };

export default function DpaPage() {
  return (
    <>
      <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1">Avtal</p>
      <h1>Personuppgiftsbiträdesavtal (DPA)</h1>
      <p className="text-sm text-white/55 mt-1">Version 1.0 · Gäller från [DATUM]</p>

      <LegalNotice level="lawyer" extra={
        <span>Detta är ett <b>utkast</b> baserat på SCC + svensk praxis. Det MÅSTE granskas av advokat
        innan ni signerar det med en kund. Specifika ansvarsfrågor, skadestånd och tvistlösning
        ska anpassas efter er verksamhet.</span>
      } />

      <h2>1. Parter</h2>
      <p>
        Detta personuppgiftsbiträdesavtal (&quot;<b>DPA</b>&quot;) ingås mellan:
      </p>
      <ul>
        <li>
          <b>Personuppgiftsansvarig</b> (&quot;Controller&quot;):
          den juridiska person som anges i tjänstens beställning eller administrationsgränssnitt
          och som använder Mailmind.
        </li>
        <li>
          <b>Personuppgiftsbiträde</b> (&quot;Processor&quot;):
          [BOLAGSNAMN AB], org-nr [ORG-NR], med säte i [STAD], Sverige (&quot;Mailmind&quot;).
        </li>
      </ul>
      <p>
        DPA:t är en bilaga till och utgör en del av tjänstens Användarvillkor och eventuellt
        Master Services Agreement (MSA) som parterna ingått.
      </p>

      <h2>2. Definitioner</h2>
      <p>
        Termer som &quot;personuppgift&quot;, &quot;behandling&quot;, &quot;personuppgiftsincident&quot;,
        &quot;den registrerade&quot;, &quot;personuppgiftsansvarig&quot; och &quot;personuppgiftsbiträde&quot;
        har samma betydelse som i Dataskyddsförordningen (GDPR) (EU) 2016/679.
      </p>

      <h2>3. Föremål och varaktighet</h2>
      <p>
        Mailmind behandlar personuppgifter för Controllers räkning i syfte att tillhandahålla
        AI-driven kundsupporttjänst. Behandlingen pågår så länge tjänsteavtalet är i kraft samt
        under den period som krävs för säker radering eller återlämning av data.
      </p>

      <h2>4. Behandlingens art och syfte</h2>
      <h3>Syfte</h3>
      <p>
        Att möjliggöra mottagning, triage, AI-driven kategorisering, AI-genererade svarsförslag
        och utskick av e-post för Controllers kundtjänstverksamhet.
      </p>

      <h3>Behandlingsoperationer</h3>
      <ul>
        <li>Mottagning av inkommande e-post via vidarebefordran (SendGrid Inbound) eller OAuth (Gmail, Microsoft Graph)</li>
        <li>Lagring i Mailminds databas (Neon, EU-Frankfurt)</li>
        <li>Skicka mejlinnehåll till AI-modell (Anthropic Claude) för analys och svarsgenerering</li>
        <li>Lagring av AI-utkast i Mailminds databas</li>
        <li>Skicka godkända svar via e-postleverantör (Resend, Gmail API eller Microsoft Graph)</li>
        <li>Loggning av användaraktivitet (audit trail)</li>
        <li>Säkerhetskopiering och katastrofåterställning</li>
      </ul>

      <h2>5. Kategorier av registrerade och personuppgifter</h2>
      <h3>Registrerade</h3>
      <ul>
        <li>Controllers anställda och agenter (Mailmind-användare)</li>
        <li>Controllers kunder, intressenter eller andra fysiska personer som skickar e-post till Controller</li>
      </ul>

      <h3>Kategorier av personuppgifter</h3>
      <ul>
        <li>Identifierande uppgifter: namn, e-postadress, organisation</li>
        <li>Innehållet i e-postmeddelanden (kan innehålla godtyckliga personuppgifter beroende på vad kunden skriver)</li>
        <li>Metadata: tidsstämplar, IP-adresser för utgående mejl, läs- och svarsstatus</li>
        <li>Tekniska identifierare: användar-ID, organisations-ID, session-ID</li>
      </ul>
      <p className="text-sm">
        <b>Särskilda kategorier:</b> Mailmind är inte designat för att behandla särskilda kategorier
        av personuppgifter (hälsodata, biometri, religion etc.) enligt GDPR art. 9. Controller
        ansvarar för att inte avsiktligt skicka sådan data genom tjänsten.
      </p>

      <h2>6. Controllers skyldigheter</h2>
      <ul>
        <li>Säkerställa att rättslig grund finns för behandlingen</li>
        <li>Inhämta nödvändiga samtycken från registrerade</li>
        <li>Tillhandahålla information enligt GDPR art. 13–14 till sina kunder</li>
        <li>Inte använda tjänsten för olagliga ändamål eller bryta mot tredje parts rättigheter</li>
        <li>Säkerställa att inställningar (t.ex. blocklist, dataretention) konfigureras korrekt</li>
      </ul>

      <h2>7. Mailminds skyldigheter</h2>
      <h3>7.1 Instruktionsbundenhet</h3>
      <p>
        Mailmind behandlar personuppgifter endast enligt dokumenterade instruktioner från Controller,
        inklusive de instruktioner som följer av tjänstens funktioner och Controllers konfiguration
        av tjänsten. Eventuella tilläggsinstruktioner ska lämnas skriftligen.
      </p>

      <h3>7.2 Konfidentialitet</h3>
      <p>
        Mailmind säkerställer att alla personer som har åtkomst till personuppgifter är bundna
        av konfidentialitetsskyldighet, antingen i anställningsavtal eller separat NDA.
      </p>

      <h3>7.3 Säkerhetsåtgärder (TOMs)</h3>
      <p>Mailmind har implementerat följande tekniska och organisatoriska åtgärder:</p>
      <ul>
        <li><b>Kryptering i vila</b>: AES-256-GCM för OAuth-tokens, AES-256 för databaslagring</li>
        <li><b>Kryptering under överföring</b>: TLS 1.2+ för all kommunikation</li>
        <li><b>Åtkomstkontroll</b>: rollbaserad åtkomst (owner/admin/member), MFA för admins</li>
        <li><b>Multi-tenant-isolering</b>: alla databasförfrågningar är organisationsscopade</li>
        <li><b>Audit logs</b>: kompletta händelseloggar med minst 24 mån retention</li>
        <li><b>Säkerhetshärdade webhooks</b>: HMAC-signaturverifiering på alla inkommande endpoints</li>
        <li><b>Rate limiting</b>: skydd mot missbruk på AI- och webhook-endpoints</li>
        <li><b>Säkerhetsheaders</b>: CSP, HSTS, X-Content-Type-Options, X-Frame-Options</li>
        <li><b>Datacenter</b>: EU-baserad infrastruktur (Neon Frankfurt, Vercel EU edge)</li>
        <li><b>Säkerhetskopior</b>: dagliga, krypterade, 30 dagars retention</li>
        <li><b>Penetrationstest</b>: planerat årligen från [ÅR]</li>
      </ul>
      <p className="text-sm">Detaljerad TOM-bilaga finns på begäran (Bilaga 1).</p>

      <h3>7.4 Underbiträden</h3>
      <p>
        Mailmind använder de underbiträden som listas på{" "}
        <a href="/legal/sub-processors">/legal/sub-processors</a>. Controller godkänner härmed dessa.
        Mailmind ska meddela Controller minst <b>30 dagar i förväg</b> vid byte eller tillägg av
        underbiträde. Controller har rätt att invända; vid invändning som inte kan lösas kommersiellt
        har Controller rätt att säga upp avtalet utan kostnad.
      </p>

      <h3>7.5 Internationella överföringar</h3>
      <p>
        För överföringar till tredje land utanför EU/EES tillämpar Mailmind:
      </p>
      <ul>
        <li>EU-kommissionens standardklausuler (SCC, 2021/914)</li>
        <li>Transfer Impact Assessment per underbiträde</li>
        <li>Tilläggsåtgärder där det krävs (kryptering, pseudonymisering, åtkomstbegränsning)</li>
      </ul>

      <h3>7.6 Bistånd till Controller</h3>
      <p>Mailmind ska, så långt det är möjligt, bistå Controller med:</p>
      <ul>
        <li>Svar på registrerades begäranden (art. 15–22)</li>
        <li>Säkerhet i behandlingen (art. 32)</li>
        <li>Anmälan av personuppgiftsincident (art. 33–34)</li>
        <li>Konsekvensbedömningar (art. 35) och förhandssamråd (art. 36)</li>
      </ul>

      <h3>7.7 Personuppgiftsincident</h3>
      <p>
        Mailmind anmäler personuppgiftsincident till Controller utan onödigt dröjsmål och senast
        inom <b>48 timmar</b> efter att Mailmind fått kännedom om incidenten. Anmälan innehåller
        så långt det är möjligt: incidentens art, ungefärligt antal berörda, kategorier av data,
        sannolika konsekvenser, vidtagna åtgärder.
      </p>

      <h3>7.8 Radering eller återlämning vid avtalsslut</h3>
      <p>
        Vid avtalets slut ska Mailmind, enligt Controllers val:
      </p>
      <ul>
        <li>Radera alla personuppgifter senast 30 dagar efter uppsägning, eller</li>
        <li>Återlämna all data via dataexport innan radering</li>
      </ul>
      <p>
        Undantag: lagstadgade krav på fortsatt lagring (t.ex. Bokföringslagen 7 år för fakturadata)
        — dessa data anonymiseras eller flyttas till legal hold där så är möjligt.
      </p>

      <h3>7.9 Audit & inspektion</h3>
      <p>
        Controller har rätt att en gång per år, med 30 dagars varsel, begära att Mailmind levererar:
      </p>
      <ul>
        <li>Skriftlig redogörelse av implementerade säkerhetsåtgärder</li>
        <li>Resultat från senaste oberoende säkerhetsrevision (när sådan finns)</li>
        <li>Aktuell underbiträdes-lista och TIA-dokumentation</li>
      </ul>
      <p>
        Fysiska inspektioner kan utföras vid skälig misstanke om brist, med kostnaden för
        inspektionen burna av Controller om ingen brist konstateras.
      </p>

      <h2>8. Ansvar och skadestånd</h2>
      <p>
        🚨 <b>[KRÄVER ADVOKATGRANSKNING]</b> Ansvarsfördelning, ansvarstak och eventuella
        undantag enligt GDPR art. 82 ska konkretiseras tillsammans med advokat. Förslag:
        Mailminds totala ansvar enligt detta DPA är begränsat till det belopp som motsvarar
        kundens avgifter under de senaste 12 månaderna.
      </p>

      <h2>9. Giltighetstid och uppsägning</h2>
      <p>
        DPA:t gäller så länge huvudavtalet är i kraft och fortsätter att gälla efter uppsägning
        i den utsträckning Mailmind fortfarande behandlar personuppgifter.
      </p>

      <h2>10. Tillämplig lag och tvistlösning</h2>
      <p>
        Svensk lag tillämpas. Tvister ska slutligt avgöras genom skiljedom enligt
        Stockholms Handelskammares Skiljedomsinstituts regler för förenklat skiljeförfarande,
        med säte i Stockholm.
      </p>
      <p className="text-sm">
        🚨 <b>[ADVOKATFRÅGA]</b> Beroende på kundsegment kan tingsrätt vara lämpligare än
        skiljedom för mindre kunder.
      </p>

      <h2>Bilaga 1 — Tekniska och organisatoriska åtgärder</h2>
      <p className="text-sm text-white/55">
        Detaljerad TOM-bilaga finns dokumenterad internt och tillhandahålls vid begäran.
        Innehåller bland annat: krypterings-specifikationer, nyckelhantering, backupstrategi,
        incident response-rutiner, åtkomstpolicies, medarbetar-training, fysisk säkerhet
        hos hosting-leverantörer.
      </p>

      <h2>Bilaga 2 — Underbiträden</h2>
      <p className="text-sm text-white/55">
        Aktuell lista finns på{" "}
        <a href="/legal/sub-processors">mailmind.se/legal/sub-processors</a>{" "}
        och uppdateras vid förändring.
      </p>

      <hr className="border-white/10 my-10" />
      <p className="text-xs text-white/40">
        Frågor om databehandling? Kontakta vår personuppgiftsansvarige på{" "}
        <a href="mailto:dpo@mailmind.se">dpo@mailmind.se</a>.
      </p>
    </>
  );
}
