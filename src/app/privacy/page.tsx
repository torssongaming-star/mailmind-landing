import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Integritetspolicy" };

type Retention = { category: string; period: string; basis: string };

const RETENTION: Retention[] = [
  { category: "Aktiva trådar och meddelanden",   period: "Obegränsat under avtalstid",          basis: "Driftsnödvändigt" },
  { category: "Stängda trådar (resolved/escalated)", period: "12 månader, därefter raderade",   basis: "Operativ retention" },
  { category: "AI-utkast",                       period: "Som tråden de tillhör",                basis: "Driftsnödvändigt" },
  { category: "Audit-loggar",                    period: "24 månader",                           basis: "Säkerhetsutredning" },
  { category: "Användarkonton",                  period: "Tills konto raderas + 30 dgr grace",   basis: "Avtal + GDPR-rättigheter" },
  { category: "Fakturadata (Stripe)",            period: "7 år",                                 basis: "Bokföringslagen (7 kap. 2 §)" },
  { category: "OAuth-tokens (Gmail/Outlook)",    period: "Tills användaren disconnectar",        basis: "Driftsnödvändigt" },
  { category: "Push-prenumerationer",            period: "Tills användaren stänger av eller 90 dgr utan användning", basis: "Driftsnödvändigt" },
  { category: "Marknadsförings-cookies",         period: "Max 24 månader",                       basis: "Samtycke" },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[hsl(var(--surface-base))] text-white">
      <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-white/45 hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Tillbaka till startsidan
        </Link>

        <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1">Policy</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Integritetspolicy</h1>
        <p className="text-sm text-white/55">Version 2.0 · Senast uppdaterad: [DATUM]</p>

        <div className="prose prose-invert max-w-none mt-10
          prose-headings:tracking-tight
          prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-3
          prose-h3:text-base prose-h3:mt-6 prose-h3:font-semibold
          prose-p:text-white/75 prose-p:leading-relaxed
          prose-strong:text-white
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-li:text-white/75 prose-li:my-1
          prose-code:text-cyan-300 prose-code:bg-white/5 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
        ">

          <h2>1. Vem är personuppgiftsansvarig?</h2>
          <p>
            <b>[BOLAGSNAMN AB]</b>, org-nr [XXXXXX-XXXX], med säte i [STAD], är
            personuppgiftsansvarig för behandlingen av dina personuppgifter som beskrivs i denna policy.
          </p>
          <p>
            Kontakt: <a href="mailto:dpo@mailmind.se">dpo@mailmind.se</a> (dataskyddsombud)
          </p>

          <h2>2. Roller</h2>
          <p>{siteConfig.siteName} har två olika roller:</p>
          <ul>
            <li><b>Personuppgiftsansvarig</b> för uppgifter om våra kunder (kontoinnehavare och deras teammedlemmar).</li>
            <li><b>Personuppgiftsbiträde</b> för uppgifter som våra B2B-kunder lägger in i tjänsten — t.ex. e-post från deras slutkunder. Behandlingen styrs då av ett separat <Link href="/legal/dpa">personuppgiftsbiträdesavtal (DPA)</Link>.</li>
          </ul>

          <h2>3. Vilka uppgifter behandlar vi och varför?</h2>

          <h3>3.1 Uppgifter om dig som kund</h3>
          <ul>
            <li><b>Identitet & kontakt</b>: namn, e-post, telefonnummer, företag, befattning</li>
            <li><b>Konto & inloggning</b>: lösenord (hashat hos Clerk), session-ID, IP, enhetsinformation</li>
            <li><b>Betalning</b>: tokeniserade kortuppgifter via Stripe (vi får aldrig rå kortdata), faktura- och betalningshistorik</li>
            <li><b>Användning</b>: vilka funktioner du använder, audit-loggar, supportärenden</li>
            <li><b>Marknadsföring</b>: e-post du angett vid demo-förfrågan, samtycke till nyhetsbrev</li>
          </ul>

          <h3>3.2 Uppgifter som behandlas å kundens vägnar</h3>
          <ul>
            <li>Innehåll i mejl som kommer in via vår tjänst (text, headers, metadata)</li>
            <li>Avsändarinformation (namn, e-post, organisation)</li>
            <li>AI-genererade svar och utvärderingar</li>
          </ul>
          <p className="text-sm">
            För denna behandling är vår kund personuppgiftsansvarig. Se vårt <Link href="/legal/dpa">DPA</Link>.
          </p>

          <h2>4. Rättslig grund</h2>

          <div className="not-prose overflow-x-auto rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/50 my-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-white/40 font-semibold">
                  <th className="px-4 py-3 border-b border-white/8">Behandling</th>
                  <th className="px-4 py-3 border-b border-white/8">Rättslig grund (GDPR art. 6)</th>
                </tr>
              </thead>
              <tbody className="text-white/70">
                <tr className="border-b border-white/5">
                  <td className="px-4 py-3">Tillhandahålla tjänsten</td>
                  <td className="px-4 py-3">Avtal (art. 6.1.b)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-3">Fakturering & bokföring</td>
                  <td className="px-4 py-3">Rättslig förpliktelse (art. 6.1.c) — Bokföringslagen</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-3">Säkerhet & bedrägeribekämpning</td>
                  <td className="px-4 py-3">Berättigat intresse (art. 6.1.f)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-3">Demo-förfrågningar</td>
                  <td className="px-4 py-3">Berättigat intresse (art. 6.1.f)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-3">Marknadsföringscookies & nyhetsbrev</td>
                  <td className="px-4 py-3">Samtycke (art. 6.1.a)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Produktförbättring (anonym analys)</td>
                  <td className="px-4 py-3">Berättigat intresse (art. 6.1.f)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>5. Vem delar vi uppgifter med?</h2>
          <p>
            Vi anlitar underbiträden för att leverera tjänsten. Komplett lista och beskrivning
            finns på <Link href="/legal/sub-processors">/legal/sub-processors</Link>. Sammanfattning:
          </p>
          <ul>
            <li><b>Neon</b> (databas, EU-Frankfurt)</li>
            <li><b>Vercel</b> (hosting, EU edge + USA admin)</li>
            <li><b>Clerk</b> (autentisering, USA)</li>
            <li><b>Stripe</b> (betalning, USA + EU)</li>
            <li><b>Anthropic</b> (AI, USA — Zero Data Retention aktiverat)</li>
            <li><b>SendGrid</b> (inkommande mejl, USA)</li>
            <li><b>Resend</b> (utgående mejl, USA + EU)</li>
            <li><b>Google / Microsoft</b> (för Gmail / Outlook-kopplade inkorgar)</li>
          </ul>
          <p>
            Vi säljer aldrig dina uppgifter och delar dem inte med tredje part för marknadsföring.
          </p>

          <h2>6. Internationella överföringar</h2>
          <p>
            Vissa av våra underbiträden behandlar uppgifter utanför EU/EES (främst USA).
            För dessa tillämpas:
          </p>
          <ul>
            <li>EU-kommissionens standardklausuler (SCC, 2021/914)</li>
            <li>Data Privacy Framework-certifiering där tillämpligt</li>
            <li>Transfer Impact Assessment per leverantör</li>
            <li>Tilläggsåtgärder: kryptering, åtkomstbegränsning, Anthropic Zero Data Retention</li>
          </ul>

          <h2>7. Hur länge sparar vi dina uppgifter?</h2>

          <div className="not-prose overflow-x-auto rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/50 my-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-white/40 font-semibold">
                  <th className="px-4 py-3 border-b border-white/8">Kategori</th>
                  <th className="px-4 py-3 border-b border-white/8">Period</th>
                  <th className="px-4 py-3 border-b border-white/8">Grund</th>
                </tr>
              </thead>
              <tbody className="text-white/70">
                {RETENTION.map(r => (
                  <tr key={r.category} className="border-b border-white/5 last:border-b-0">
                    <td className="px-4 py-3 text-white">{r.category}</td>
                    <td className="px-4 py-3">{r.period}</td>
                    <td className="px-4 py-3 text-xs">{r.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>8. Dina rättigheter</h2>
          <p>Som registrerad har du följande rättigheter enligt GDPR:</p>
          <ul>
            <li><b>Tillgång</b> (art. 15) — du kan begära en kopia av dina uppgifter</li>
            <li><b>Rättelse</b> (art. 16) — felaktiga uppgifter ska rättas</li>
            <li><b>Radering</b> (art. 17) — &quot;rätten att bli glömd&quot;, gäller med vissa undantag</li>
            <li><b>Begränsning</b> (art. 18) — du kan begära att behandlingen tillfälligt stoppas</li>
            <li><b>Dataportabilitet</b> (art. 20) — du kan få ut dina uppgifter i maskinläsbart format</li>
            <li><b>Invändning</b> (art. 21) — mot behandling som baseras på berättigat intresse</li>
            <li><b>Återkallande av samtycke</b> — när behandlingen baseras på samtycke</li>
          </ul>

          <h3>Hur du utövar dina rättigheter</h3>
          <ul>
            <li><b>Inloggad kund</b>: använd <code>/app/settings/account</code> för att exportera all data eller radera kontot</li>
            <li><b>Skriftlig begäran</b>: skicka e-post till <a href="mailto:dpo@mailmind.se">dpo@mailmind.se</a></li>
            <li><b>Svarstid</b>: inom en månad enligt GDPR art. 12.3</li>
            <li><b>Klagomål</b>: du kan klaga till <a href="https://www.imy.se" target="_blank" rel="noopener noreferrer">Integritetsskyddsmyndigheten (IMY)</a></li>
          </ul>

          <h2>9. Säkerhet</h2>
          <p>
            Vi tillämpar tekniska och organisatoriska åtgärder för att skydda dina uppgifter mot
            obehörig åtkomst, förlust och missbruk. Detaljer finns i vår <Link href="/security">Säkerhetspolicy</Link> och
            i bilaga 1 till vårt <Link href="/legal/dpa">DPA</Link>.
          </p>

          <h2>10. AI-bearbetning</h2>
          <p>
            Mailmind använder generativ AI (Anthropic Claude Haiku 4.5) för att analysera mejl och
            föreslå svar. Viktigt att veta:
          </p>
          <ul>
            <li>Alla AI-svar är förslag — en människa godkänner innan utskick (med undantag för auto-send som kräver hög confidence och separat aktivering)</li>
            <li>Vi tränar INTE AI på era data</li>
            <li>Anthropic Zero Data Retention är aktiverat — Anthropic loggar inte input/output</li>
            <li>AI:n kan göra fel — vi rekommenderar mänsklig granskning av alla svar</li>
          </ul>

          <h2>11. Cookies</h2>
          <p>
            Vi använder strikt nödvändiga cookies, funktionella cookies (efter samtycke) och
            anonym analys (efter samtycke). Se vår <Link href="/cookies">Cookie-policy</Link> och hantera
            ditt samtycke via &quot;Cookie-inställningar&quot; i sidfoten.
          </p>

          <h2>12. Ändringar i denna policy</h2>
          <p>
            Vid större ändringar meddelas registrerade kunder via e-post minst 30 dagar i förväg.
            Mindre förtydliganden träder i kraft vid publicering.
          </p>

          <h2>13. Kontakt</h2>
          <ul>
            <li>Dataskyddsombud: <a href="mailto:dpo@mailmind.se">dpo@mailmind.se</a></li>
            <li>Säkerhetsincidenter: <a href="mailto:security@mailmind.se">security@mailmind.se</a></li>
            <li>Klagomål till tillsynsmyndighet: <a href="https://www.imy.se" target="_blank" rel="noopener noreferrer">imy.se</a></li>
          </ul>
        </div>
      </div>
    </main>
  );
}
