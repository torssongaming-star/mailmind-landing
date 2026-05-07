"use client";

import { useState } from "react";

type Client = "outlook-web" | "outlook-app" | "gmail" | "apple-mail";

const CLIENTS: { id: Client; label: string }[] = [
  { id: "outlook-web",  label: "Outlook (webb)" },
  { id: "outlook-app",  label: "Outlook (app)" },
  { id: "gmail",        label: "Gmail" },
  { id: "apple-mail",   label: "Apple Mail" },
];

const STEPS: Record<Client, { title: string; steps: string[] }> = {
  "outlook-web": {
    title: "Outlook på webben (outlook.com / Microsoft 365)",
    steps: [
      "Öppna Outlook i webbläsaren och logga in.",
      "Klicka på kugghjulet ⚙️ uppe till höger → välj Visa alla Outlook-inställningar.",
      "Gå till E-post → Vidarebefordring.",
      'Aktivera "Vidarebefordra min e-post till" och klistra in din Mailmind-adress nedan.',
      "Klicka Spara. Klart — nya mejl vidarebefordras direkt till Mailmind.",
    ],
  },
  "outlook-app": {
    title: "Outlook-appen (Windows / Mac)",
    steps: [
      "Vidarebefordring konfigureras på servern, inte i appen.",
      "Om du använder Microsoft 365: logga in på outlook.office.com och följ stegen för Outlook (webb) ovan.",
      "Om du använder en Exchange-server: kontakta din IT-administratör och be dem aktivera vidarebefordring till din Mailmind-adress.",
    ],
  },
  "gmail": {
    title: "Gmail",
    steps: [
      "Öppna Gmail och klicka på kugghjulet ⚙️ → Visa alla inställningar.",
      "Gå till fliken Vidarebefordring och POP/IMAP.",
      "Klicka Lägg till en vidarebefordringsadress och klistra in din Mailmind-adress nedan.",
      "Google skickar ett verifieringsmejl — klicka på länken i det mejlet.",
      "Välj Vidarebefordra en kopia av inkommande e-post och klicka Spara ändringar.",
    ],
  },
  "apple-mail": {
    title: "Apple Mail (iCloud)",
    steps: [
      "Gå till icloud.com/mail och logga in.",
      "Klicka på kugghjulet ⚙️ nere till vänster → Inställningar.",
      "Välj fliken Allmänt → aktivera Vidarebefordra min e-post till.",
      "Klistra in din Mailmind-adress och klicka Klar.",
    ],
  },
};

export function ForwardingGuide({ mailmindAddress }: { mailmindAddress: string }) {
  const [open, setOpen]     = useState(false);
  const [client, setClient] = useState<Client>("outlook-web");
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(mailmindAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const guide = STEPS[client];

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.03] overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-base">📬</span>
          <div>
            <p className="text-sm font-semibold text-white">Sätt upp vidarebefordring</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Steg-för-steg guide — välj din e-postklient
            </p>
          </div>
        </div>
        <span className="text-muted-foreground text-sm transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "none" }}>
          ▾
        </span>
      </button>

      {open && (
        <div className="border-t border-cyan-500/10 px-5 pb-5 space-y-4">

          {/* Address copy box */}
          <div className="rounded-lg bg-black/30 px-3 py-2.5 flex items-center justify-between gap-3 mt-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                Din Mailmind-adress
              </p>
              <p className="text-sm font-mono text-cyan-300 truncate">{mailmindAddress}</p>
            </div>
            <button
              onClick={copy}
              className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white transition-colors shrink-0"
            >
              {copied ? "Kopierat!" : "Kopiera"}
            </button>
          </div>

          {/* Client tabs */}
          <div className="flex flex-wrap gap-1.5">
            {CLIENTS.map(c => (
              <button
                key={c.id}
                onClick={() => setClient(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  client === c.id
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : "bg-white/5 text-muted-foreground border border-white/10 hover:text-white hover:border-white/20"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Steps */}
          <div>
            <p className="text-xs font-semibold text-white/80 mb-3">{guide.title}</p>
            <ol className="space-y-2.5">
              {guide.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-white/80 leading-relaxed">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Video placeholder */}
          <div className="rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3 flex items-center gap-3">
            <span className="text-xl">▶️</span>
            <div>
              <p className="text-xs font-semibold text-white/70">Kort video-guide kommer snart</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Vi spelar in en 60-sekunders video för varje e-postklient.
              </p>
            </div>
          </div>

          {/* Help link */}
          <p className="text-[10px] text-muted-foreground">
            Fungerar det inte?{" "}
            <a href="mailto:support@mailmind.se" className="text-cyan-400 hover:underline">
              Kontakta support →
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
