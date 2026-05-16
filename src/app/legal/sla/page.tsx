import type { Metadata } from "next";
import { LegalNotice } from "../LegalNotice";

export const metadata: Metadata = { title: "Service Level Agreement (SLA)" };

export default function SlaPage() {
  return (
    <>
      <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1">Servicenivå</p>
      <h1>Service Level Agreement (SLA)</h1>
      <p className="text-sm text-white/55 mt-1">Version 1.0 · Gäller från [DATUM]</p>

      <LegalNotice level="review" extra={
        <span>Tjänstenivåer och kreditprocent bör anpassas till faktisk kapacitet ni kan leverera.
        Starter-nivån är medvetet konservativ. Diskutera med advokat hur återbetalning konkretiseras
        i förhållande till MSA innan ni säger upp specifika garantier.</span>
      } />

      <p>
        Mailmind förbinder sig att leverera tjänsten enligt nedanstående nivåer. SLA gäller alla
        betalande kunder och börjar gälla när första fakturan är betald (gäller ej under provperiod).
      </p>

      <h2>1. Drifttid (Uptime)</h2>

      <div className="not-prose overflow-x-auto rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/50 my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-white/40 font-semibold">
              <th className="px-4 py-3 border-b border-white/8">Plan</th>
              <th className="px-4 py-3 border-b border-white/8">Månadsvis drifttid</th>
              <th className="px-4 py-3 border-b border-white/8">Max nedtid/månad</th>
              <th className="px-4 py-3 border-b border-white/8">Servicekredit</th>
            </tr>
          </thead>
          <tbody className="text-white/70">
            <tr className="border-b border-white/5">
              <td className="px-4 py-3 font-semibold text-white">Starter</td>
              <td className="px-4 py-3 tabular-nums">99,5%</td>
              <td className="px-4 py-3 tabular-nums">~3h 38min</td>
              <td className="px-4 py-3 text-xs">10% kredit vid 99,0–99,5% / 25% vid &lt; 99,0%</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="px-4 py-3 font-semibold text-white">Pro</td>
              <td className="px-4 py-3 tabular-nums">99,9%</td>
              <td className="px-4 py-3 tabular-nums">~43min</td>
              <td className="px-4 py-3 text-xs">25% kredit vid 99,0–99,9% / 50% vid &lt; 99,0%</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-white">Enterprise</td>
              <td className="px-4 py-3 tabular-nums">99,95%</td>
              <td className="px-4 py-3 tabular-nums">~22min</td>
              <td className="px-4 py-3 text-xs">Förhandlas i MSA</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Vad räknas som nedtid?</h3>
      <p>Tid då följande funktioner är otillgängliga:</p>
      <ul>
        <li>Inloggning till app.mailmind.se</li>
        <li>Mottagning av inkommande e-post (SendGrid Inbound, Gmail push, Microsoft Graph)</li>
        <li>Generering av AI-utkast</li>
        <li>Skicka godkända svar</li>
      </ul>

      <h3>Vad räknas INTE som nedtid?</h3>
      <ul>
        <li>Schemalagt underhåll (meddelas minst 7 dagar i förväg)</li>
        <li>Akut säkerhetsunderhåll (meddelas så snart det är möjligt)</li>
        <li>Problem orsakade av kunden (felkonfiguration, brutna OAuth-tokens)</li>
        <li>Force majeure (krig, naturkatastrof, statliga ingrepp)</li>
        <li>Tredjepartsleverantörers fel där SLA-nivå ligger inom respektive leverantörs SLA (Vercel, Neon, Stripe, Anthropic)</li>
      </ul>

      <h2>2. Support-svarstider</h2>

      <div className="not-prose overflow-x-auto rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/50 my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-white/40 font-semibold">
              <th className="px-4 py-3 border-b border-white/8">Allvarsgrad</th>
              <th className="px-4 py-3 border-b border-white/8">Beskrivning</th>
              <th className="px-4 py-3 border-b border-white/8">Starter</th>
              <th className="px-4 py-3 border-b border-white/8">Pro</th>
              <th className="px-4 py-3 border-b border-white/8">Enterprise</th>
            </tr>
          </thead>
          <tbody className="text-white/70">
            <tr className="border-b border-white/5">
              <td className="px-4 py-3 font-semibold text-white">P1 — Kritisk</td>
              <td className="px-4 py-3 text-xs">Tjänsten är otillgänglig</td>
              <td className="px-4 py-3 tabular-nums">8h (kontorstid)</td>
              <td className="px-4 py-3 tabular-nums">4h (24/7)</td>
              <td className="px-4 py-3 tabular-nums">1h (24/7)</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="px-4 py-3 font-semibold text-white">P2 — Hög</td>
              <td className="px-4 py-3 text-xs">Stor funktion påverkad</td>
              <td className="px-4 py-3 tabular-nums">1 arbetsdag</td>
              <td className="px-4 py-3 tabular-nums">8h (kontorstid)</td>
              <td className="px-4 py-3 tabular-nums">4h (kontorstid)</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="px-4 py-3 font-semibold text-white">P3 — Medel</td>
              <td className="px-4 py-3 text-xs">Mindre funktion påverkad</td>
              <td className="px-4 py-3 tabular-nums">2 arbetsdagar</td>
              <td className="px-4 py-3 tabular-nums">1 arbetsdag</td>
              <td className="px-4 py-3 tabular-nums">8h (kontorstid)</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-white">P4 — Låg</td>
              <td className="px-4 py-3 text-xs">Fråga, feedback, kosmetiskt</td>
              <td className="px-4 py-3 tabular-nums">5 arbetsdagar</td>
              <td className="px-4 py-3 tabular-nums">2 arbetsdagar</td>
              <td className="px-4 py-3 tabular-nums">1 arbetsdag</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-sm">
        Kontorstid: vardagar 09:00–17:00 CET, exkl. svenska helgdagar.
        Support nås via <a href="mailto:support@mailmind.se">support@mailmind.se</a>.
      </p>

      <h2>3. Begäran om servicekredit</h2>
      <p>
        Kredit dras inte automatiskt. För att kvittera kredit:
      </p>
      <ol>
        <li>Mejla <a href="mailto:billing@mailmind.se">billing@mailmind.se</a> inom 30 dagar efter incidenten</li>
        <li>Inkludera datum, tid och beskrivning av nedtiden</li>
        <li>Kredit drags från nästa faktura</li>
      </ol>
      <p className="text-sm">
        Maximal kredit per månad är 50% av planavgiften. Kredit ges som rabatt på framtida fakturor —
        inte som kontant återbetalning.
      </p>

      <h2>4. Datasäkerhet & backuper</h2>
      <ul>
        <li>Dagliga backuper av databas, krypterade, 30 dagars retention</li>
        <li>Point-in-time recovery: senaste 7 dagarna</li>
        <li>Recovery Time Objective (RTO): &lt; 4h vid katastrofåterställning</li>
        <li>Recovery Point Objective (RPO): &lt; 1h dataförlust</li>
      </ul>

      <h2>5. Incidentnotifiering</h2>
      <ul>
        <li>Större incidenter: e-post till kontoinnehavare inom 30 minuter efter upptäckt</li>
        <li>Statusuppdateringar minst varje timme tills lösning</li>
        <li>Post-mortem för P1-incidenter inom 5 arbetsdagar</li>
        <li>Statussida: <code>status.mailmind.se</code> [⚠️ planerad, ej live ännu]</li>
      </ul>

      <h2>6. Förändringar</h2>
      <p>
        Förändringar av SLA-nivåer som påverkar kund negativt meddelas minst 60 dagar i förväg.
        Kunder har då rätt att säga upp avtalet utan kostnad.
      </p>
    </>
  );
}
