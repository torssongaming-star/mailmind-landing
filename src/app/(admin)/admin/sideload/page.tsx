import {
  Download,
  Monitor,
  Globe,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";

const MANIFEST_URL = "https://mailmind.se/addins/outlook/manifest.xml";

export default function SideloadGuidePage() {
  return (
    <div className="p-8 space-y-10 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <Monitor className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-white text-3xl font-bold tracking-tight">Outlook sideload-guide</h1>
          <p className="text-slate-400 mt-1">
            Installera Mailmind-tillägget i Outlook för demo eller pilot. Tar ~2 minuter.
          </p>
        </div>
      </div>

      {/* Quick download */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex items-center justify-between">
        <div>
          <p className="text-white font-bold text-sm">manifest.xml</p>
          <p className="text-slate-500 text-xs mt-0.5">
            Ladda ned och spara lokalt — behövs i installationsstegen nedan.
          </p>
        </div>
        <a
          href={MANIFEST_URL}
          download="mailmind-manifest.xml"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-black font-bold text-xs rounded-xl hover:bg-cyan-300 transition-all"
        >
          <Download className="w-4 h-4" />
          Ladda ned manifest
        </a>
      </div>

      {/* Prerequisites */}
      <Section icon={AlertCircle} iconColor="text-amber-400" title="Krav">
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            Microsoft 365-konto (Business Basic eller högre)
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            Outlook på webben <em>eller</em> Outlook desktop 2016+ (version 16.0+)
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            Mailmind-konto skapt via{" "}
            <Link href="/admin/onboarding" className="text-primary hover:underline">
              Admin → Provision kund
            </Link>
          </li>
          <li className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <span>
              Exchange-administratör måste <em>inte</em> godkänna sideloading om{" "}
              <strong className="text-white">sideloading är aktiverat</strong> i M365 Admin Center
              (standardinställning för de flesta tenants).
            </span>
          </li>
        </ul>
      </Section>

      {/* Method A — OWA */}
      <Section icon={Globe} iconColor="text-cyan-400" title="Metod A — Outlook på webben (rekommenderas för demo)">
        <p className="text-slate-400 text-xs mb-5">
          Fungerar i alla webbläsare. Inga adminsrättigheter krävs av kunden.
        </p>
        <Steps>
          <Step n={1}>
            Öppna{" "}
            <a href="https://outlook.office.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              outlook.office.com
            </a>{" "}
            och logga in med M365-kontot.
          </Step>
          <Step n={2}>
            Öppna <strong>valfritt e-postmeddelande</strong> (klicka på det).
          </Step>
          <Step n={3}>
            Klicka på <Kbd>···</Kbd> (Fler åtgärder) i meddelandefältet → välj{" "}
            <strong>Hämta tillägg</strong> (Get Add-ins).
          </Step>
          <Step n={4}>
            I dialogrutan — klicka på fliken <Kbd>Mina tillägg</Kbd> →{" "}
            <strong>Lägg till anpassat tillägg</strong> → <strong>Lägg till från fil</strong>.
          </Step>
          <Step n={5}>
            Ladda upp den nedladdade <code className="text-primary text-xs">mailmind-manifest.xml</code>.
          </Step>
          <Step n={6}>
            Bekräfta varningen (sideloaded tillägg är inte granskade av Microsoft) → klicka{" "}
            <Kbd>Installera</Kbd>.
          </Step>
          <Step n={7}>
            Stäng dialogrutan. Öppna ett e-postmeddelande — knappen{" "}
            <strong>&ldquo;Triage med Mailmind&rdquo;</strong> ska nu synas i meddelandets verktygsfält.
          </Step>
        </Steps>
      </Section>

      {/* Method B — Desktop */}
      <Section icon={Monitor} iconColor="text-violet-400" title="Metod B — Outlook desktop (Windows)">
        <p className="text-slate-400 text-xs mb-5">
          Desktop-klienten hanterar tillägg via OWA-portalen i bakgrunden.
        </p>
        <Steps>
          <Step n={1}>
            Öppna Outlook → klicka på <Kbd>Arkiv</Kbd> → <strong>Hantera tillägg</strong>.
            <br />
            <span className="text-slate-500 text-xs">
              (Det öppnar outlook.office.com i webbläsaren — fortsätt därifrån med Metod A steg 3–7.)
            </span>
          </Step>
          <Step n={2}>
            Stäng webbläsarfliken när tillägget är installerat.
          </Step>
          <Step n={3}>
            Starta om Outlook desktop. Öppna ett mejl — knappen ska synas i fliken{" "}
            <Kbd>Start</Kbd> under gruppen <strong>Mailmind</strong>.
          </Step>
        </Steps>
        <div className="mt-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-200 text-xs flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
          <span>
            Om knappen inte syns direkt: högerklicka på menyfliksområdet → <strong>Anpassa menyfliksområdet</strong>{" "}
            och se till att gruppen Mailmind är aktiverad.
          </span>
        </div>
      </Section>

      {/* Testing checklist */}
      <Section icon={ClipboardList} iconColor="text-green-400" title="Testchecklista — bekräfta att allt fungerar">
        <p className="text-slate-400 text-xs mb-5">
          Gå igenom detta innan ett kundmöte eller demo.
        </p>
        <div className="space-y-3">
          {[
            { label: "Tillägget är installerat och knappen syns i verktygsfältet" },
            { label: "Klick på knappen öppnar Mailmind-panelen (taskpanen)" },
            { label: "Inloggning via Clerk fungerar (dialogrutan öppnas, session sparas)" },
            { label: "Panelen visar kundens org-namn och plan korrekt" },
            { label: "\"Triage detta mejl\" läser ämne + avsändare + brödtext utan fel" },
            { label: "Resultatet visar klassificering + confidence-poäng" },
            { label: "Utkastet visas i panelen och länken öppnar rätt tråd i /app/inbox" },
            { label: "Tråden syns i Mailmind-inkorgen med rätt status" },
          ].map((item, i) => (
            <label key={i} className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" className="mt-0.5 accent-primary shrink-0" />
              <span className="text-slate-300 text-sm group-hover:text-white transition-colors">
                {item.label}
              </span>
            </label>
          ))}
        </div>
      </Section>

      {/* Troubleshooting */}
      <Section icon={AlertCircle} iconColor="text-red-400" title="Felsökning">
        <div className="space-y-4 text-sm">
          <Trouble
            q='Felmeddelande: "Add-ins are disabled by your organization"'
            a="Exchange-admin måste aktivera sideloading i M365 Admin Center → Settings → Services → User owned apps and services → låt användare ladda ned tillägg."
          />
          <Trouble
            q="Knappen syns men panelen visar blank sida"
            a="Kontrollera att tilläggets domän (mailmind.se) är nåbar. I demo-läge lokalt: manifestet måste peka på en publik URL — localhost fungerar inte för Outlook-tillägg."
          />
          <Trouble
            q='"Triage detta mejl" returnerar 401 Unauthorized'
            a="Kunden är inte inloggad i Mailmind eller Clerk-sessionen har gått ut. Klicka på Log in i panelen och autentisera på nytt."
          />
          <Trouble
            q='"Triage detta mejl" returnerar 403 App access blocked'
            a="Kundens prenumeration är inaktiv eller spärrad. Kontrollera i Admin → Organizations → org-detaljsidan."
          />
          <Trouble
            q="Kunde inte läsa mejlkroppen"
            a="Outlook-versionen stöder inte Mailbox 1.3. Krävs: Outlook 2016 version 16.0.6741+ eller Outlook på webben. Äldre Outlook 2013 stöds ej."
          />
        </div>
      </Section>
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function Section({
  title, icon: Icon, iconColor, children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-6 space-y-4">
      <h2 className="text-white font-bold flex items-center gap-2 border-b border-white/5 pb-3">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        {title}
      </h2>
      {children}
    </div>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-4">{children}</ol>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 border border-primary/30 text-primary text-[11px] font-bold flex items-center justify-center mt-0.5">
        {n}
      </span>
      <span className="text-slate-300 text-sm leading-relaxed">{children}</span>
    </li>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-[11px] font-mono text-white">
      {children}
    </kbd>
  );
}

function Trouble({ q, a }: { q: string; a: string }) {
  return (
    <div className="space-y-1">
      <p className="flex items-start gap-2 text-white font-medium">
        <ChevronRight className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        {q}
      </p>
      <p className="text-slate-400 text-xs ml-6 leading-relaxed">{a}</p>
    </div>
  );
}
