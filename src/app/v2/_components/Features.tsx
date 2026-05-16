"use client";

import {
  Sparkles, Tag, BookOpen, ShieldCheck, MessageCircle, Globe, Inbox, FileText,
} from "lucide-react";

const FEATURES = [
  { icon: Sparkles,    title: "AI-utkast",            body: "Förslag för varje inkommande mejl — granska och skicka." },
  { icon: Tag,         title: "Auto-kategorisering",  body: "Offert, reklamation, bokning — AI:n märker upp innan du läser." },
  { icon: BookOpen,    title: "Kunskapsbas",          body: "AI:n svarar från ert FAQ och er hemsida. Aldrig hittade-på-fakta." },
  { icon: MessageCircle, title: "Ton & röst",          body: "Formellt, vänligt eller neutralt. AI:n matchar er stil." },
  { icon: Inbox,       title: "Delad inkorg",         body: "Hela teamet ser samma trådar, samma status." },
  { icon: Globe,       title: "Flerspråkigt",         body: "Svenska, engelska, norska, danska, finska — automatiskt." },
  { icon: FileText,    title: "Mallar & makros",      body: "Spara återkommande svar. AI:n vet när de ska användas." },
  { icon: ShieldCheck, title: "Människa godkänner",   body: "Inget skickas utan ditt OK — om du inte aktivt aktiverar autosvar." },
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-28 px-6 border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-2">
            Funktioner
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] text-white">
            Allt ni behöver. Inget mer.
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/40 backdrop-blur-sm p-5 transition-all hover:border-white/15 hover:bg-[hsl(var(--surface-elev-1))]/70"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center mb-4">
                  <Icon size={15} className="text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1.5 tracking-tight">{f.title}</h3>
                <p className="text-[12px] text-white/50 leading-relaxed">{f.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
