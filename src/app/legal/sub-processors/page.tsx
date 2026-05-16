import type { Metadata } from "next";
import { LegalNotice } from "../LegalNotice";

export const metadata: Metadata = { title: "Underbiträden" };

type Sub = {
  name:        string;
  purpose:     string;
  dataTypes:   string;
  region:      string;
  transfer:    string;
  added:       string;
};

const SUBS: Sub[] = [
  {
    name:      "Neon (Databas)",
    purpose:   "Primär datalagring (PostgreSQL)",
    dataTypes: "All applikationsdata: trådar, mejl-innehåll, användare, inställningar",
    region:    "EU — Frankfurt (AWS eu-central-1)",
    transfer:  "Inom EU/EES — ingen tredjelandsöverföring",
    added:     "2025-01-01",
  },
  {
    name:      "Vercel (Hosting)",
    purpose:   "Hosting av webbapplikation, edge functions, statiska tillgångar",
    dataTypes: "Request-loggar, IP-adresser, performance-metrik",
    region:    "EU edge för EU-användare; USA för admin & analytics",
    transfer:  "SCC + DPF-certifierad",
    added:     "2025-01-01",
  },
  {
    name:      "Clerk (Autentisering)",
    purpose:   "Inloggning, sessioner, användarprofil",
    dataTypes: "Användares e-postadress, namn, OAuth-tokens, sessions",
    region:    "USA (Frankfurt-region kan väljas vid uppgradering)",
    transfer:  "SCC + DPF-certifierad",
    added:     "2025-01-01",
  },
  {
    name:      "Stripe (Betalning)",
    purpose:   "Hantering av abonnemang, betalningar, fakturor",
    dataTypes: "Kontaktuppgifter, betalkort (token), abonnemangsdata",
    region:    "USA + Irland",
    transfer:  "SCC + DPF-certifierad",
    added:     "2025-01-01",
  },
  {
    name:      "Anthropic (AI)",
    purpose:   "Generering av AI-svarsförslag och triage",
    dataTypes: "Mejl-innehåll (skickas till modellen vid varje förfrågan)",
    region:    "USA",
    transfer:  "SCC + Zero Data Retention-tillägg signerat. Anthropic loggar inte och tränar inte på data.",
    added:     "2025-01-01",
  },
  {
    name:      "SendGrid (Inkommande mejl)",
    purpose:   "Mottagning av inkommande e-post via Inbound Parse",
    dataTypes: "Allt innehåll i mejl som vidarebefordras till slug@mail.mailmind.se",
    region:    "USA",
    transfer:  "SCC + DPF-certifierad",
    added:     "2025-01-01",
  },
  {
    name:      "Resend (Utgående mejl)",
    purpose:   "Utskick av notiser och godkända svar (när Gmail/Outlook-OAuth ej används)",
    dataTypes: "Mottagaradress, mejl-innehåll, leveransstatus",
    region:    "USA + EU",
    transfer:  "SCC + DPF-certifierad",
    added:     "2025-01-01",
  },
  {
    name:      "Google (Gmail API)",
    purpose:   "Mottagning/sändning för Gmail-kopplade inkorgar (OAuth)",
    dataTypes: "Mejl-innehåll, metadata, OAuth-tokens",
    region:    "Globalt (Google-regioner)",
    transfer:  "SCC + DPF-certifierad. OAuth-tokens lagras AES-256-GCM-krypterade hos oss.",
    added:     "2025-02-15",
  },
  {
    name:      "Microsoft (Graph API)",
    purpose:   "Mottagning/sändning för Outlook/M365-kopplade inkorgar (OAuth)",
    dataTypes: "Mejl-innehåll, metadata, OAuth-tokens, subscription notifications",
    region:    "EU + USA (Microsoft regions)",
    transfer:  "SCC + DPF-certifierad. OAuth-tokens lagras AES-256-GCM-krypterade hos oss.",
    added:     "2025-03-01",
  },
  {
    name:      "Vercel Analytics",
    purpose:   "Anonym webb-statistik",
    dataTypes: "Anonyma sidvisningar, ingen IP, ingen persistent identifierare",
    region:    "USA",
    transfer:  "Inga personuppgifter i traditionell mening enligt Vercel; ändå SCC.",
    added:     "2025-01-01",
  },
];

export default function SubProcessorsPage() {
  return (
    <>
      <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1">Transparens</p>
      <h1>Underbiträden</h1>
      <p className="text-sm text-white/55 mt-1">Senast uppdaterad: [DATUM]</p>

      <LegalNotice level="review" extra={
        <span>Bekräfta att alla DPA-tillägg är signerade hos respektive leverantör innan sidan publiceras.
        Specifikt: <b>Anthropic Zero Data Retention</b> kräver separat påfyllning hos Anthropic.</span>
      } />

      <p>
        Mailmind anlitar nedanstående underbiträden (sub-processors) för att leverera tjänsten.
        Alla har granskats för att uppfylla GDPR och har separata personuppgiftsbiträdesavtal
        eller motsvarande dokumentation med oss.
      </p>

      <h2>Aktuell lista</h2>

      <div className="not-prose overflow-x-auto rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/50 my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-white/40 font-semibold">
              <th className="px-4 py-3 border-b border-white/8">Tjänst</th>
              <th className="px-4 py-3 border-b border-white/8">Syfte</th>
              <th className="px-4 py-3 border-b border-white/8">Data</th>
              <th className="px-4 py-3 border-b border-white/8">Region</th>
              <th className="px-4 py-3 border-b border-white/8">Skydd</th>
              <th className="px-4 py-3 border-b border-white/8">Tillagd</th>
            </tr>
          </thead>
          <tbody>
            {SUBS.map(s => (
              <tr key={s.name} className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-semibold text-white align-top">{s.name}</td>
                <td className="px-4 py-3 text-white/70 align-top">{s.purpose}</td>
                <td className="px-4 py-3 text-white/60 align-top text-xs">{s.dataTypes}</td>
                <td className="px-4 py-3 text-white/60 align-top text-xs">{s.region}</td>
                <td className="px-4 py-3 text-white/60 align-top text-xs">{s.transfer}</td>
                <td className="px-4 py-3 text-white/45 align-top text-xs tabular-nums whitespace-nowrap">{s.added}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Notifiering vid förändring</h2>
      <p>
        När ett underbiträde läggs till eller byts ut meddelar vi kunder minst <b>30 dagar i förväg</b>
        via e-post till kontoinnehavaren. Kunder kan invända; vid invändning som inte kan lösas
        kommersiellt har kunden rätt att säga upp avtalet utan kostnad.
      </p>

      <h2>Internationella överföringar</h2>
      <p>
        Vissa underbiträden behandlar data utanför EU/EES. För dessa tillämpas:
      </p>
      <ul>
        <li>EU-kommissionens standardklausuler (SCC, 2021/914)</li>
        <li>Transfer Impact Assessment (TIA) per leverantör</li>
        <li>Tilläggsåtgärder där så krävs (kryptering, åtkomstkontroll)</li>
        <li>Data Privacy Framework-certifiering där tillämpligt</li>
      </ul>

      <h2>Frågor?</h2>
      <p>
        Kontakta vår personuppgiftsansvarige på{" "}
        <a href="mailto:dpo@mailmind.se">dpo@mailmind.se</a>{" "}
        för dokumentation av specifika SCC, DPA:er och TIA:er.
      </p>
    </>
  );
}
