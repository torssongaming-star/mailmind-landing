"use client";

const STEPS = [
  {
    n: "01",
    title: "Koppla din inkorg",
    body: "Outlook, Gmail eller via vidarebefordran. Klart på 2 minuter.",
  },
  {
    n: "02",
    title: "AI:n lär sig ditt företag",
    body: "Vi importerar er hemsida, era ärendetyper och bygger en kunskapsbas. Inga generiska svar.",
  },
  {
    n: "03",
    title: "Mejl kommer in",
    body: "Mailmind triagerar, kategoriserar och föreslår ett svar för varje inkommande tråd.",
  },
  {
    n: "04",
    title: "Du godkänner",
    body: "En klick. Svar går iväg via din egen mejladress. Eskaleras till människa när AI:n är osäker.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-20 md:py-28 px-6 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-2">
            Så funkar det
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] text-white">
            Från första mejlet
            <br />
            <span className="text-white/45">till skickat svar.</span>
          </h2>
        </div>

        <div className="relative grid md:grid-cols-2 gap-4 md:gap-x-12 md:gap-y-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex gap-5 group">
              {/* Step number */}
              <div className="shrink-0 relative">
                <div className="w-11 h-11 rounded-2xl border border-white/10 bg-[hsl(var(--surface-elev-1))]/70 backdrop-blur-sm flex items-center justify-center font-mono text-[13px] text-white/45 group-hover:border-primary/30 group-hover:text-primary transition-colors">
                  {s.n}
                </div>
                {i < STEPS.length - 1 && i % 2 === 0 && (
                  <div className="absolute top-11 left-1/2 -translate-x-1/2 h-12 w-px bg-gradient-to-b from-white/8 to-transparent md:hidden" aria-hidden />
                )}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h3 className="text-base font-semibold text-white tracking-tight">{s.title}</h3>
                <p className="text-sm text-white/55 leading-relaxed mt-1.5">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
