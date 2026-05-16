"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, Zap } from "lucide-react";

export function Hero() {
  return (
    <section className="relative pt-32 md:pt-40 pb-16 md:pb-24 px-6">
      <div className="max-w-5xl mx-auto text-center">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-sm mb-6">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inline-flex w-full h-full rounded-full bg-primary opacity-75 animate-ping" />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-primary" />
          </span>
          <span className="text-[11px] font-medium text-white/65 tracking-wide uppercase">AI för svensk B2B-support</span>
        </div>

        {/* Headline — text-5xl/6xl (NOT 7xl), tight tracking, no gradient text */}
        <h1 className="text-[40px] md:text-[64px] leading-[1.05] font-semibold tracking-[-0.025em] text-white">
          Kundsupport som
          <br />
          <span className="text-white/55">förstår dig.</span>
        </h1>

        {/* Subhead */}
        <p className="mt-6 max-w-2xl mx-auto text-base md:text-lg text-white/55 leading-relaxed">
          Mailmind triagerar inkommande mejl, kategoriserar dem och föreslår svar.
          Din agent godkänner med ett klick. AI:n är granskad, källgrundad och bygd för svenska SMB.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="#contact"
            className="group inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-primary text-[hsl(var(--surface-base))] text-sm font-semibold hover:bg-cyan-300 transition-all shadow-[0_4px_24px_-2px_hsl(189_94%_43%/0.45)] hover:shadow-[0_6px_32px_-2px_hsl(189_94%_43%/0.6)]"
          >
            Boka demo
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="#how"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-xl border border-white/10 text-sm font-medium text-white/80 hover:text-white hover:bg-white/[0.04] hover:border-white/20 transition-colors"
          >
            Se hur det funkar
          </Link>
        </div>

        {/* Trust line */}
        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-white/35">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={11} className="text-primary/70" />
            GDPR-anpassat
          </span>
          <span className="w-1 h-1 rounded-full bg-white/15" />
          <span className="flex items-center gap-1.5">
            <Zap size={11} className="text-primary/70" />
            Data i EU
          </span>
          <span className="w-1 h-1 rounded-full bg-white/15" />
          <span>Bygd i Sverige</span>
        </div>
      </div>

      {/* Mockup placeholder — visar att produkten finns utan att gömma den bakom marketing */}
      <div className="max-w-5xl mx-auto mt-16 md:mt-20">
        <div className="relative rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/60 backdrop-blur-md shadow-[0_24px_80px_-20px_hsl(189_94%_43%/0.3)] overflow-hidden">
          {/* Browser-chrome bar */}
          <div className="h-9 border-b border-white/8 flex items-center px-4 gap-1.5 bg-[hsl(var(--surface-deep))]/60">
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="ml-4 text-[10px] text-white/30 font-mono">app.mailmind.se/inbox</span>
          </div>
          {/* Mock app preview */}
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] min-h-[360px]">
            {/* Thread list */}
            <div className="border-r border-white/8 bg-[hsl(var(--surface-deep))]/30 hidden md:block">
              {[
                { name: "Anna Berg",       subj: "Offertförfrågan altan",     dot: "bg-green-400 animate-pulse-soft" },
                { name: "Erik Lindqvist",  subj: "Faktura saknas",            dot: "bg-amber-400" },
                { name: "Karin Eriksson",  subj: "Bokning av tid v.42",       dot: "bg-green-400 animate-pulse-soft" },
                { name: "Lukas Holm",      subj: "Beställning #4019",         dot: "bg-white/20" },
                { name: "Sara Wallin",     subj: "Återbetalning",             dot: "bg-red-400" },
              ].map((t, i) => (
                <div
                  key={i}
                  className={[
                    "flex items-start gap-2.5 px-3 py-2.5 border-l-2 transition-colors",
                    i === 0
                      ? "border-primary bg-primary/[0.06]"
                      : "border-transparent",
                  ].join(" ")}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 shadow-[0_0_6px_currentColor] ${t.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/90 font-medium truncate">{t.name}</p>
                    <p className="text-[10px] text-white/40 truncate">{t.subj}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Right pane */}
            <div className="p-6 flex flex-col gap-4">
              <div>
                <p className="text-[11px] text-white/40">Anna Berg &lt;anna@bolag.se&gt;</p>
                <p className="text-sm font-semibold text-white mt-1">Offertförfrågan altan</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-3 text-xs text-white/70 leading-relaxed">
                Hej! Jag undrar om ni kan ge en grov uppskattning på en altanbygge — ca 30 m², trä, Stockholm.
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3 space-y-2 shadow-[0_2px_18px_-8px_hsl(189_94%_43%/0.4)]">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-primary">AI-utkast</span>
                  <span className="text-[9px] text-white/35">94% säkerhet</span>
                </div>
                <p className="text-xs text-white/90 leading-relaxed">
                  Hej Anna! Tack för din förfrågan. För 30 m² altan i trä kan vi titta på ett par alternativ —
                  vill du ha en kostnadsfri platsbesiktning nästa vecka?
                </p>
                <div className="flex gap-2 pt-1">
                  <button className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-primary text-[hsl(var(--surface-base))]">Skicka</button>
                  <button className="text-[10px] font-semibold px-2.5 py-1 rounded-md border border-white/10 text-white/70">Redigera</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
