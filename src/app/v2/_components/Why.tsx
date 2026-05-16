"use client";

import { Mail, Clock, AlertTriangle } from "lucide-react";

const PROBLEMS = [
  {
    icon: Mail,
    title: "Inkorg svämmar över",
    body: "Supportmejl ramlar in snabbare än ni hinner svara. Viktigt går förlorat.",
  },
  {
    icon: Clock,
    title: "Triage tar mer tid än svaren",
    body: "Att läsa, sortera, kategorisera — det är där timmarna går. Inte i att hjälpa kunden.",
  },
  {
    icon: AlertTriangle,
    title: "Standard-AI är för risky",
    body: "Generiska bots ger fel info om priser och tider. De kan inte er verksamhet.",
  },
];

export function Why() {
  return (
    <section id="why" className="py-20 md:py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-2">
            Varför Mailmind
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] text-white">
            Kundsupport ska inte vara
            <br />
            <span className="text-white/45">en flaskhals.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {PROBLEMS.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={i}
                className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/40 backdrop-blur-sm p-6 transition-colors hover:border-white/12 hover:bg-[hsl(var(--surface-elev-1))]/70"
              >
                <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/8 flex items-center justify-center mb-4">
                  <Icon size={16} className="text-white/55" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">{p.title}</h3>
                <p className="text-[13px] text-white/55 leading-relaxed">{p.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
