import type { Metadata } from "next";
import { LegalNotice } from "../LegalNotice";

export const metadata: Metadata = { title: "Master Services Agreement (MSA)" };

export default function MsaPage() {
  return (
    <>
      <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1">Avtal · enterprise</p>
      <h1>Master Services Agreement (MSA)</h1>
      <p className="text-sm text-white/55 mt-1">Version 1.0 · Mall för enterprise-avtal</p>

      <LegalNotice level="lawyer" extra={
        <span>
          Detta är ett <b>utkast</b>. MSA är ett juridiskt bindande huvudavtal som ersätter
          standard-ToS för större kunder. Det MÅSTE granskas och anpassas av advokat innan
          det signeras. Specifikt: ansvarsbegränsning, indemnification, IP-rättigheter och
          tvistlösning är klausuler där fel formulering kan ge stora ekonomiska konsekvenser.
        </span>
      } />

      <p>
        För enterprise-kunder erbjuder vi ett individuellt Master Services Agreement (MSA)
        med tillhörande Order Form. MSA ersätter våra standardvillkor och kan inkludera:
      </p>

      <ul>
        <li>Specifika SLA-nivåer (uptime, support-svarstider)</li>
        <li>Förlängd retention av audit-data</li>
        <li>Single Sign-On (SAML/OIDC)</li>
        <li>Dedikerad kontaktperson och kvartalsmöten</li>
        <li>Anpassat DPA med specifika TIA:er</li>
        <li>Förlängd uppsägningstid</li>
        <li>Specifik geografisk dataresidens</li>
      </ul>

      <h2>Mallstruktur — översikt</h2>

      <h3>1. Definitioner</h3>
      <p>Kund, Tjänst, Order Form, Documentation, Confidential Information, Effective Date, Subscription Term, etc.</p>

      <h3>2. Tjänsten</h3>
      <ul>
        <li>2.1 Beviljande av användarrätt (icke-exklusiv, icke-överlåtbar, världsomfattande)</li>
        <li>2.2 Tjänstens beskrivning (refererar Documentation)</li>
        <li>2.3 Förbättringar och nya funktioner</li>
        <li>2.4 Beta-funktioner (separata villkor)</li>
      </ul>

      <h3>3. Kundens skyldigheter</h3>
      <ul>
        <li>3.1 Acceptable Use (refererar AUP)</li>
        <li>3.2 Säker hantering av kontouppgifter</li>
        <li>3.3 Slutanvändarinformation enligt GDPR</li>
        <li>3.4 Compliance med tillämplig lag</li>
      </ul>

      <h3>4. Avgifter och betalning</h3>
      <ul>
        <li>4.1 Avgifter enligt Order Form</li>
        <li>4.2 Fakturering (årlig, månadsvis enligt val)</li>
        <li>4.3 Skatter (moms separat)</li>
        <li>4.4 Påminnelser och dröjsmålsränta vid utebliven betalning</li>
        <li>4.5 Prisförändringar (60 dagars notis)</li>
      </ul>

      <h3>5. Avtalstid och uppsägning</h3>
      <ul>
        <li>5.1 Initial Term (12, 24 eller 36 månader)</li>
        <li>5.2 Auto-renewal med uppsägningstid (vanligen 60 dagar)</li>
        <li>5.3 Uppsägning för väsentligt avtalsbrott (cure period 30 dagar)</li>
        <li>5.4 Konsekvenser av uppsägning (dataexport, radering)</li>
      </ul>

      <h3>6. Konfidentialitet</h3>
      <ul>
        <li>6.1 Definition av Confidential Information</li>
        <li>6.2 Skyldighet att skydda (samma vård som egen konfidentiell information)</li>
        <li>6.3 Undantag (allmänt känd, lagstadgade, etc.)</li>
        <li>6.4 Varaktighet (5 år efter avtalsslut)</li>
      </ul>

      <h3>7. Immateriella rättigheter</h3>
      <ul>
        <li>7.1 <b>Kunden äger Customer Data</b> — alla mejl, kontakter, inställningar</li>
        <li>7.2 <b>Mailmind äger plattformen</b> — kod, modeller, design</li>
        <li>7.3 Begränsad licens till Mailmind att använda Customer Data för att leverera tjänsten</li>
        <li>7.4 Feedback från kunden får användas fritt av Mailmind</li>
      </ul>

      <h3>8. Garantier och friskrivningar</h3>
      <ul>
        <li>8.1 Mailmind garanterar lagenlig drift och att tjänsten väsentligen följer Documentation</li>
        <li>8.2 Inga garantier för AI-svarens korrekthet — kunden ansvarar för granskning</li>
        <li>8.3 Friskrivning från underförstådda garantier (säljbarhet, lämplighet för viss användning)</li>
      </ul>

      <h3>9. Ansvarsbegränsning</h3>
      <p>🚨 <b>[ADVOKATKRITISK]</b></p>
      <ul>
        <li>9.1 Totalt ansvar begränsat till avgifter under senaste 12 månaderna</li>
        <li>9.2 Inget ansvar för indirekta skador, följdskador, förlorade vinster</li>
        <li>9.3 Undantag: skada vid grov oaktsamhet, uppsåt, brott mot konfidentialitet, IP-intrång, datasäkerhetsbrott</li>
      </ul>

      <h3>10. Indemnification</h3>
      <p>🚨 <b>[ADVOKATKRITISK]</b></p>
      <ul>
        <li>10.1 Mailmind skadeståndsansvarar för IP-intrång i tjänsten</li>
        <li>10.2 Kunden skadeståndsansvarar för (a) AUP-brott, (b) krav från slutkunder pga kundens användning</li>
      </ul>

      <h3>11. Personuppgifter</h3>
      <p>Refererar separat DPA (<a href="/legal/dpa">/legal/dpa</a>) som bilaga.</p>

      <h3>12. Force Majeure</h3>
      <p>Standardklausul — krig, terror, pandemi, naturkatastrof, statliga ingrepp.</p>

      <h3>13. Tvistlösning</h3>
      <ul>
        <li>13.1 Svensk lag tillämpas</li>
        <li>13.2 Skiljedom enligt SCC Skiljedomsinstitutets regler, säte Stockholm, språk svenska (eller engelska för internationella kunder)</li>
        <li>13.3 Eskaleringsprocess: kontaktperson → eskalering på exekutivnivå → skiljedom som sista utväg</li>
      </ul>

      <h3>14. Övrigt</h3>
      <ul>
        <li>14.1 Hela avtalet (Entire Agreement)</li>
        <li>14.2 Ändringar kräver skriftlig form</li>
        <li>14.3 Överlåtelse (kräver godkännande utom vid bolagsförsäljning)</li>
        <li>14.4 Notiser (e-post + post)</li>
        <li>14.5 Delvis ogiltighet</li>
      </ul>

      <h2>Bilagor</h2>
      <ul>
        <li>Bilaga A: Order Form (anpassas per kund)</li>
        <li>Bilaga B: <a href="/legal/dpa">Personuppgiftsbiträdesavtal (DPA)</a></li>
        <li>Bilaga C: <a href="/legal/sla">Service Level Agreement</a></li>
        <li>Bilaga D: <a href="/legal/sub-processors">Underbiträden</a></li>
        <li>Bilaga E: Tekniska och organisatoriska åtgärder (TOMs)</li>
      </ul>

      <h2>Intresserad av enterprise?</h2>
      <p>
        Kontakta <a href="mailto:enterprise@mailmind.se">enterprise@mailmind.se</a>{" "}
        så går vi igenom vad ni behöver och tar fram en anpassad offert.
      </p>
    </>
  );
}
