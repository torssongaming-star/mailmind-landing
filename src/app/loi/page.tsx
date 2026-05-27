/**
 * /loi — Letter of Intent landing.
 *
 * Publik sida där företag skriver på en formell avsiktsförklaring inför
 * Mailmind:s lansering. Inte juridiskt bindande, men daterad viljeyttring
 * som ger oss social proof och förstånd av marknadens efterfrågan.
 *
 * Visar:
 *   - Hero med kort förklaring av vad LOI är
 *   - Formulär (LoiForm.tsx, client component)
 *   - Verifierad/expired-banner via ?verified=-query
 *   - Footer-disclaimer
 */

import Link from "next/link";
import { LoiForm } from "./LoiForm";
import { LegalFooter } from "@/components/layout/LegalFooter";

import type { Metadata } from "next";
export const metadata: Metadata = {
  title:       "Avsiktsförklaring — Mailmind",
  description: "Skriv på en daterad avsiktsförklaring för Mailmind inför lanseringen. Inte juridiskt bindande.",
};

export const dynamic = "force-dynamic";

export default async function LoiPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const { verified } = await searchParams;

  return (
    <div className="relative min-h-screen bg-[hsl(var(--surface-base))] text-white antialiased">
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background:
            "radial-gradient(ellipse 1200px 800px at 50% -10%, hsl(189 94% 43% / 0.12), transparent 60%), " +
            "radial-gradient(ellipse 800px 600px at 85% 100%, hsl(262 83% 58% / 0.06), transparent 50%)",
        }}
        aria-hidden
      />

      <main className="max-w-3xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24">
        {/* Tillbaka-länk */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-white/55 hover:text-white transition-colors mb-8"
        >
          ← Tillbaka till mailmind.se
        </Link>

        {/* Verifierings-banner */}
        {verified === "1" && (
          <div className="mb-8 rounded-xl border border-green-500/30 bg-green-500/[0.05] px-4 py-3 flex items-start gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400 mt-0.5 shrink-0" aria-hidden>
              <path d="M5 12l4 4L19 7" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-green-200">Mejladressen bekräftad</p>
              <p className="text-xs text-green-200/70 leading-relaxed mt-0.5">
                Tack — vi hör av oss inför lansering. Du kan stänga den här fliken.
              </p>
            </div>
          </div>
        )}
        {verified === "expired" && (
          <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] px-4 py-3">
            <p className="text-sm font-semibold text-amber-200">Länken är förbrukad eller har gått ut</p>
            <p className="text-xs text-amber-200/70 leading-relaxed mt-0.5">
              Skriv på igen nedan så skickar vi en ny bekräftelselänk.
            </p>
          </div>
        )}
        {verified === "error" && (
          <div className="mb-8 rounded-xl border border-red-500/30 bg-red-500/[0.05] px-4 py-3">
            <p className="text-sm font-semibold text-red-300">Något gick fel vid verifieringen</p>
            <p className="text-xs text-red-300/70 leading-relaxed mt-0.5">
              Mejla <a href="mailto:hello@mailmind.se" className="underline">hello@mailmind.se</a> så löser vi det manuellt.
            </p>
          </div>
        )}

        {/* Header */}
        <header className="mb-10 space-y-3">
          <p className="text-[11px] uppercase tracking-widest text-primary font-semibold">
            Pre-launch
          </p>
          <h1 className="text-3xl md:text-[44px] font-semibold tracking-[-0.02em] text-white leading-[1.1]">
            Säkra er plats
          </h1>
          <p className="text-base text-white/75 leading-relaxed max-w-xl">
            Anmäl ert intresse nedan — vi kontaktar er personligt när Mailmind
            är redo att ta emot kunder. Ni får prioriterad demo, assisterad
            onboarding och möjlighet att påverka produkten innan lansering.
            Det är <strong className="text-white">inte juridiskt bindande</strong> och kan dras tillbaka när som helst.
          </p>
        </header>

        {/* Vad det innebär */}
        <div className="mb-10 rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/40 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Vad innebär det?</h2>
          <ul className="space-y-2 text-sm text-white/75 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">·</span>
              Ni signalerar aktivt intresse av att utvärdera Mailmind vid lansering.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">·</span>
              Ni får en personlig demo + onboarding-prioritet när vi går live.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">·</span>
              Ni binder er inte till köp — avsiktsförklaringen är ensidig och kan dras tillbaka när som helst.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">·</span>
              Vi sparar er signatur (namn, företag, tidsstämpel, IP) som bevis på den daterade viljeyttringen.
            </li>
          </ul>
        </div>

        {/* Formuläret */}
        <LoiForm />
      </main>

      <LegalFooter />
    </div>
  );
}
