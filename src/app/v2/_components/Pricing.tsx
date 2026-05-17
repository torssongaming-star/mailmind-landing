"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { PLAN_LIST } from "@/lib/plans";

/** P1.2 — show price incl. Swedish VAT (25%) for B2B transparency.
 *  Accepts "€19" / "199 kr" / "19" and returns same shape × 1.25 rounded. */
function priceWithVat(price: string): string {
  const match = price.match(/^([^0-9]*)([0-9]+(?:[.,][0-9]+)?)\s*(.*)$/);
  if (!match) return price;
  const [, prefix, num, suffix] = match;
  const n = parseFloat(num.replace(",", "."));
  if (isNaN(n)) return price;
  const withVat = Math.round(n * 1.25);
  return `${prefix}${withVat}${suffix ? " " + suffix : ""}`;
}

export function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-28 px-6 border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-2">
            Priser
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] text-white">
            Enkla priser.
            <br />
            <span className="text-white/45">Inga överraskningar.</span>
          </h2>
          <p className="mt-5 text-sm text-white/55">
            Provperiod 14 dagar utan kostnad. Inga bindningstider, inga uppsägningsavgifter.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
          {PLAN_LIST.map((plan, i) => {
            const popular = plan.popular;
            return (
              <div
                key={plan.id}
                className={[
                  "relative rounded-2xl border p-6 flex flex-col transition-colors",
                  popular
                    ? "border-primary/30 bg-primary/[0.04] shadow-[0_8px_40px_-12px_hsl(189_94%_43%/0.35)]"
                    : "border-white/8 bg-[hsl(var(--surface-elev-1))]/40 hover:border-white/15",
                ].join(" ")}
              >
                {popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-primary bg-[hsl(var(--surface-base))] border border-primary/30 px-2.5 py-0.5 rounded-full">
                      Populärast
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-sm font-semibold text-white">{plan.name}</p>
                  <p className="text-[12px] text-white/45 mt-1 leading-relaxed">{plan.description}</p>
                </div>

                <div className="mb-5">
                  {plan.id === "enterprise" ? (
                    <p className="text-2xl font-semibold text-white tracking-tight">Kontakta oss</p>
                  ) : (
                    <>
                      <p className="text-3xl font-semibold text-white tracking-tight tabular-nums">
                        {plan.price}
                        <span className="text-xs text-white/40 font-normal">/mån</span>
                      </p>
                      <p className="text-[10px] text-white/35 mt-1 tabular-nums">
                        exkl. moms · {priceWithVat(plan.price)}/mån inkl. moms
                      </p>
                    </>
                  )}
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((feat, j) => (
                    <li key={j} className="flex items-start gap-2 text-[13px] text-white/65 leading-relaxed">
                      <Check size={13} className="text-primary shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.id === "enterprise" ? "#contact" : "/signup"}
                  className={[
                    "inline-flex items-center justify-center h-10 px-4 rounded-xl text-sm font-semibold transition-colors",
                    popular
                      ? "bg-primary text-[hsl(var(--surface-base))] hover:bg-cyan-300 shadow-[0_4px_18px_-2px_hsl(189_94%_43%/0.45)]"
                      : "border border-white/10 text-white hover:bg-white/[0.04] hover:border-white/20",
                  ].join(" ")}
                >
                  {plan.id === "enterprise" ? "Boka samtal" : "Kom igång"}
                </Link>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-xs text-white/35 max-w-xl mx-auto leading-relaxed">
          Alla priser exkl. moms. Årsabonnemang ger 17% rabatt. Ändra eller säg upp när som helst.
        </p>
      </div>
    </section>
  );
}
