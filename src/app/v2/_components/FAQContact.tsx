"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ArrowRight, Mail } from "lucide-react";

const FAQ = [
  {
    q: "Hur lång tid tar det att komma igång?",
    a: "Cirka 30 minuter för att koppla inkorg och köra onboarding. AI:n importerar er hemsida automatiskt så ni inte behöver mata in fakta manuellt.",
  },
  {
    q: "Skickas mejl automatiskt utan att vi godkänner?",
    a: "Nej. I standardläge måste ni godkänna varje svar. Auto-send kan aktiveras senare när ni gjort dry-run i 20 svar och ser att kvaliteten är hög, och endast på svar med ≥90% confidence.",
  },
  {
    q: "Var lagras våra data?",
    a: "I EU — Frankfurt (Neon Postgres). USA-leverantörer används bara för specifika ändamål (Stripe, Anthropic AI) och täcks av standardklausuler.",
  },
  {
    q: "Tränar ni AI på våra data?",
    a: "Nej. Anthropic Zero Data Retention är aktiverat — ert mejlinnehåll loggas inte och används inte för träning.",
  },
  {
    q: "Vad händer om AI:n inte vet svaret?",
    a: "Då eskaleras tråden med en intern sammanfattning till er säljare. AI:n säger aldrig saker den inte hittat i er kunskapsbas — den ber om hjälp istället.",
  },
  {
    q: "Kan jag säga upp när som helst?",
    a: "Ja. Inga bindningstider, inga uppsägningsavgifter. Ni kan exportera all data och radera kontot från app-inställningarna.",
  },
];

export function FAQContact() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="contact" className="py-20 md:py-28 px-6 border-t border-white/5">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-[1fr_360px] gap-12 lg:gap-16">

        {/* FAQ */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-2">
            Vanliga frågor
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] text-white mb-10">
            Bra svar
            <br />
            <span className="text-white/45">på bra frågor.</span>
          </h2>

          <div className="divide-y divide-white/8 border-t border-b border-white/8">
            {FAQ.map((item, i) => {
              const isOpen = open === i;
              return (
                <div key={i}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 py-4 text-left group focus-visible:outline-none"
                  >
                    <span className="text-[15px] font-medium text-white group-hover:text-primary transition-colors">
                      {item.q}
                    </span>
                    <ChevronDown
                      size={16}
                      className={[
                        "text-white/40 shrink-0 transition-transform duration-200",
                        isOpen ? "rotate-180 text-primary" : "",
                      ].join(" ")}
                    />
                  </button>
                  <div
                    className={[
                      "grid transition-all duration-200",
                      isOpen ? "grid-rows-[1fr] opacity-100 pb-4" : "grid-rows-[0fr] opacity-0",
                    ].join(" ")}
                  >
                    <div className="overflow-hidden">
                      <p className="text-sm text-white/60 leading-relaxed max-w-prose">{item.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Contact CTA */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-[hsl(var(--surface-elev-1))]/40 to-[hsl(var(--surface-elev-1))]/40 p-6 backdrop-blur-sm shadow-[0_8px_40px_-12px_hsl(189_94%_43%/0.35)]">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center mb-5">
              <Mail size={16} className="text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-white tracking-tight">Boka 20 minuters demo</h3>
            <p className="text-sm text-white/55 mt-2 leading-relaxed">
              Vi visar Mailmind med era exempel-mejl och svarar på alla frågor. Inget säljsamtal — bara produkten.
            </p>
            <Link
              href="mailto:hej@mailmind.se?subject=Boka%20demo"
              className="mt-5 group inline-flex items-center justify-center gap-1.5 w-full h-11 rounded-xl bg-primary text-[hsl(var(--surface-base))] text-sm font-semibold hover:bg-cyan-300 transition-all shadow-[0_4px_18px_-2px_hsl(189_94%_43%/0.45)]"
            >
              Skicka mejl
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-3 text-[11px] text-white/35 text-center">
              eller ring{" "}
              <a href="tel:+46812345678" className="text-white/55 hover:text-white underline">
                08-123 456 78
              </a>
            </p>
          </div>
        </aside>

      </div>
    </section>
  );
}
