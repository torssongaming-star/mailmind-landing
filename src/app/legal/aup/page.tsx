import type { Metadata } from "next";
import { LegalNotice } from "../LegalNotice";

export const metadata: Metadata = { title: "Acceptabel användning (AUP)" };

export default function AupPage() {
  return (
    <>
      <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1">Policy</p>
      <h1>Acceptabel användning</h1>
      <p className="text-sm text-white/55 mt-1">Version 1.0 · Gäller från [DATUM]</p>

      <LegalNotice level="review" extra={
        <span>Innehållet är säkert som utgångspunkt — gå igenom listan över förbjuden användning
        och justera till just er bransch. Konsekvensavsnittet (avstängning, terminering) bör
        läsas igenom av advokat om ni planerar att åberopa den utan rättelse.</span>
      } />

      <p>
        Denna policy (&quot;<b>AUP</b>&quot;) beskriver hur Mailmind får och inte får användas.
        Den gäller alla användare av tjänsten och ingår som en del av Användarvillkoren.
        Brott mot AUP kan leda till avstängning eller uppsägning av kontot.
      </p>

      <h2>1. Allmänna principer</h2>
      <p>Mailmind får användas för att:</p>
      <ul>
        <li>Triagera inkommande e-post för legitim kundsupportverksamhet</li>
        <li>Generera AI-svarsförslag som granskas av människa innan utskick</li>
        <li>Arkivera, söka och hantera kundkonversationer</li>
        <li>Integrera med Gmail, Outlook eller via vidarebefordrad e-post</li>
      </ul>

      <h2>2. Förbjuden användning</h2>
      <p>Du får INTE använda Mailmind för att:</p>

      <h3>2.1 Olaglig eller skadlig verksamhet</h3>
      <ul>
        <li>Bryta mot svensk eller internationell lag</li>
        <li>Skicka phishing-mejl, bedrägerier eller social manipulation</li>
        <li>Sprida skadlig kod, virus, ransomware eller annan kod som är skadlig för system</li>
        <li>Sondera, skanna eller testa sårbarheter hos andra system utan tillstånd</li>
        <li>Hota, trakassera eller förfölja personer</li>
      </ul>

      <h3>2.2 Spam och oönskad kommunikation</h3>
      <ul>
        <li>Skicka massutskick (kalla mejl, marknadsföring) utan rättslig grund</li>
        <li>Köpa eller använda inköpta e-postlistor</li>
        <li>Skicka mejl till mottagare som har avregistrerat sig</li>
        <li>Använda tjänsten för att kringgå anti-spam-tekniker (SPF, DKIM, DMARC, blocklists)</li>
        <li>Förvränga avsändaridentitet eller header-information</li>
      </ul>

      <h3>2.3 Brott mot dataskydd</h3>
      <ul>
        <li>Behandla särskilda kategorier av personuppgifter (hälsa, biometri, religion, etc.) utan giltig rättslig grund och DPA-tillägg</li>
        <li>Behandla barns personuppgifter utan vårdnadshavares samtycke</li>
        <li>Använda tjänsten för att behandla data som omfattas av sekretess (t.ex. patientjournaler) utan särskilt avtal</li>
        <li>Bryta mot informationsplikt enligt GDPR art. 13–14 mot era egna kunder</li>
      </ul>

      <h3>2.4 AI-missbruk</h3>
      <ul>
        <li>Försöka kringgå Mailminds AI-skyddsåtgärder (prompt injection, jailbreaking)</li>
        <li>Använda AI-svar för att lura, vilseleda eller manipulera mottagare</li>
        <li>Generera vilseledande information om priser, tillgänglighet eller produkter</li>
        <li>Använda AI för att skapa innehåll som bryter mot Anthropics{" "}
          <a href="https://www.anthropic.com/legal/aup" target="_blank" rel="noopener noreferrer">
            Usage Policies
          </a>
        </li>
        <li>Auto-skicka AI-svar utan mänsklig granskning innan tjänstens dry-run-tröskel är uppfylld</li>
      </ul>

      <h3>2.5 Tekniskt missbruk</h3>
      <ul>
        <li>Försöka komma åt andra organisationers data</li>
        <li>Överskrida planens tekniska begränsningar avsiktligt (t.ex. via skript)</li>
        <li>Reverse-engineera, dekompilera eller demontera tjänsten</li>
        <li>Vidareförsälja eller hyra ut tjänsten utan skriftligt avtal</li>
        <li>Skapa fler konton för att kringgå begränsningar eller avstängningar</li>
        <li>Försöka belasta tjänsten oproportionerligt (DoS, scraping)</li>
      </ul>

      <h3>2.6 Innehåll</h3>
      <ul>
        <li>Spridning av barnpornografi, terrorism-propaganda, hat mot folkgrupp eller liknande olagligt innehåll</li>
        <li>Spridning av upphovsrättsskyddat material utan rättigheter</li>
        <li>Spridning av personuppgifter (doxxing)</li>
      </ul>

      <h2>3. Rapportering av missbruk</h2>
      <p>
        Misstänkt missbruk av Mailmind eller upptäckta säkerhetshål kan rapporteras till{" "}
        <a href="mailto:abuse@mailmind.se">abuse@mailmind.se</a>{" "}
        eller{" "}
        <a href="mailto:security@mailmind.se">security@mailmind.se</a>.
        Vi behandlar alla rapporter konfidentiellt.
      </p>

      <h2>4. Konsekvenser vid brott</h2>
      <p>Beroende på allvarsgrad och om brottet upprepas kan Mailmind:</p>
      <ol>
        <li><b>Varna</b> kontoinnehavaren skriftligen med möjlighet att åtgärda</li>
        <li><b>Pausa funktioner</b> tillfälligt (t.ex. AI-generering, e-postutskick)</li>
        <li><b>Stänga av kontot</b> i avvaktan på utredning</li>
        <li><b>Säga upp avtalet</b> omedelbart vid allvarliga eller upprepade brott</li>
        <li>Vid olaglig verksamhet: <b>anmäla till relevant myndighet</b></li>
      </ol>
      <p>
        Vid omedelbar uppsägning på grund av AUP-brott återbetalas inga avgifter.
        Vid varning ges normalt minst 14 dagar för rättelse.
      </p>

      <h2>5. Tredjeparts AUPs</h2>
      <p>Genom att använda Mailmind förbinder du dig också till våra leverantörers villkor:</p>
      <ul>
        <li><a href="https://www.anthropic.com/legal/aup" target="_blank" rel="noopener noreferrer">Anthropic Usage Policy</a></li>
        <li><a href="https://www.twilio.com/legal/aup" target="_blank" rel="noopener noreferrer">SendGrid (Twilio) AUP</a></li>
        <li><a href="https://resend.com/legal/acceptable-use" target="_blank" rel="noopener noreferrer">Resend AUP</a></li>
        <li><a href="https://stripe.com/legal/restricted-businesses" target="_blank" rel="noopener noreferrer">Stripe Restricted Businesses</a></li>
      </ul>

      <h2>6. Ändringar</h2>
      <p>
        Vi kan uppdatera denna AUP. Större förändringar meddelas via e-post till
        kontoinnehavaren minst 30 dagar i förväg. Mindre förtydliganden träder i kraft
        direkt vid publicering.
      </p>
    </>
  );
}
