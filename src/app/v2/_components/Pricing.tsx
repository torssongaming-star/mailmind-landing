"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { PLAN_LIST, type Currency } from "@/lib/plans";

/** P1.2 — show price incl. Swedish VAT (25%) for B2B transparency.
 *  Accepts "€19", "€16", "199 kr", "1 999 kr" and returns same shape × 1.25 rounded. */
function priceWithVat(price: string): string {
  // Capture leading currency symbol/prefix, the (possibly space-separated) digit
  // group, and any trailing suffix (e.g. "kr").
  const match = price.match(/^([^\d]*)([\d\s.,]+?)(\s*[A-Za-zåäöÅÄÖ]+)?$/);
  if (!match) return price;
  const [, prefix, rawNum, suffix = ""] = match;
  const n = parseFloat(rawNum.replace(/\s/g, "").replace(",", "."));
  if (isNaN(n)) return price;
  const withVat = Math.round(n * 1.25);
  // Re-format SEK with thin space thousand separator for readability
  const formatted = suffix.trim().toLowerCase() === "kr"
    ? withVat.toLocaleString("sv-SE")
    : String(withVat);
  return `${prefix}${formatted}${suffix}`;
}

export function Pricing({ currency = "EUR" }: { currency?: Currency }) {
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const isAnnual = period === "annual";
  const isSEK    = currency === "SEK";

  return (
    <section id="pricing" className="py-20 md:py-28 px-6 border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div className="text-center max-w-2xl mx-auto mb-10 md:mb-12">
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

        {/* Period toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-1 gap-1">
            <button
              onClick={() => setPeriod("monthly")}
              className={[
                "h-8 px-4 rounded-lg text-xs font-semibold transition-all",
                !isAnnual
                  ? "bg-white/[0.08] text-white shadow-sm"
                  : "text-white/45 hover:text-white/70",
              ].join(" ")}
            >
              Månadsvis
            </button>
            <button
              onClick={() => setPeriod("annual")}
              className={[
                "h-8 px-4 rounded-lg text-xs font-semibold transition-all flex items-center gap-2",
                isAnnual
                  ? "bg-white/[0.08] text-white shadow-sm"
                  : "text-white/45 hover:text-white/70",
              ].join(" ")}
            >
              Årsvis
              <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full leading-none">
                −17%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
          {PLAN_LIST.map((plan) => {
            const popular = plan.popular;

            // Pick currency-specific fields
            const monthlyPrice       = isSEK ? plan.priceSEK              : plan.price;
            const annualPrice        = isSEK ? plan.priceAnnualSEK        : plan.priceAnnual;
            const monthlyWhenAnnual  = isSEK ? plan.priceMonthlyAnnualSEK : plan.priceMonthlyAnnual;
            const savingsLabel       = isSEK ? plan.savingsLabelSEK       : plan.savingsLabel;

            // Annual view shows the YEAR total as primary; monthly view shows month price.
            const headlinePrice = isAnnual ? annualPrice  : monthlyPrice;
            const headlineUnit  = isAnnual ? "/år"        : "/mån";
            const headlineVat   = priceWithVat(headlinePrice);
            const subline       = isAnnual
              ? `motsv. ${monthlyWhenAnnual}/mån · ${headlineVat}/år inkl. moms`
              : `exkl. moms · ${headlineVat}/mån inkl. moms`;

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
                {/* Popular badge */}
                {popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-primary bg-[hsl(var(--surface-base))] border border-primary/30 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                      Populärast
                    </span>
                  </div>
                )}

                {/* Plan name + description */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white">{plan.name}</p>
                    {isAnnual && savingsLabel && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap">
                        {savingsLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-white/45 mt-1 leading-relaxed">{plan.description}</p>
                </div>

                {/* Price block */}
                <div className="mb-5">
                  {plan.id === "enterprise" ? (
                    <p className="text-2xl font-semibold text-white tracking-tight">Kontakta oss</p>
                  ) : (
                    <>
                      <p className="text-3xl font-semibold text-white tracking-tight tabular-nums">
                        {headlinePrice}
                        <span className="text-xs text-white/40 font-normal">{headlineUnit}</span>
                      </p>
                      <p className="text-[10px] text-white/35 mt-1 tabular-nums">
                        {subline}
                      </p>
                    </>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((feat, j) => (
                    <li key={j} className="flex items-start gap-2 text-[13px] text-white/65 leading-relaxed">
                      <Check size={13} className="text-primary shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={
                    plan.id === "enterprise"
                      ? "#contact"
                      : isAnnual
                        ? `/signup?period=annual&plan=${plan.id}`
                        : `/signup?plan=${plan.id}`
                  }
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
          Alla priser exkl. moms. Årsabonnemang faktureras som en betalning och ger 17% rabatt.
          Ändra eller säg upp när som helst.
        </p>
      </div>
    </section>
  );
}
