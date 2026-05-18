import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";
import { DEMO_EXAMPLES } from "@/app/api/public/demo-triage/route";
import { DemoSandbox } from "./DemoSandbox";

export const metadata: Metadata = {
  title:       "Prova Mailmind — se AI:n triagera ett mejl live",
  description: "Välj ett exempelmejl och se hur Mailmind kategoriserar det, samlar information och föreslår ett svar — utan registrering.",
};

export default function TryPage() {
  return (
    <main className="min-h-screen bg-[hsl(var(--surface-base))] text-white">
      {/* Atmospheric background */}
      <div
        className="fixed inset-0 pointer-events-none -z-10 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 700px 500px at 60% 10%, hsl(189 94% 43% / 0.10), transparent 60%), " +
            "radial-gradient(ellipse 500px 400px at 20% 80%, hsl(262 83% 58% / 0.07), transparent 60%)",
        }}
        aria-hidden
      />

      <div className="max-w-3xl mx-auto px-6 py-10 md:py-16">
        {/* Top nav */}
        <div className="flex items-center justify-between mb-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-white/40 hover:text-white transition-colors group"
          >
            <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
            Tillbaka
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/25 flex items-center justify-center">
              <Mail size={12} className="text-primary" />
            </div>
            <span className="text-sm font-semibold text-white/80">Mailmind</span>
          </Link>
        </div>

        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-sm mb-4">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-primary opacity-75 animate-ping" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-primary" />
            </span>
            <span className="text-[11px] font-medium text-white/65 tracking-wide uppercase">
              Live-demo — ingen registrering
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-3">
            Se AI:n triagera ett mejl
          </h1>
          <p className="text-base text-white/55 max-w-xl mx-auto leading-relaxed">
            Välj ett av tre exempelmejl nedan. AI:n analyserar det, avgör vad kunden vill ha
            och föreslår ett svar — precis som den gör för riktiga kunder.
          </p>
          <p className="text-xs text-white/30 mt-3">
            Demo-företag: <span className="text-white/45 font-medium">Acme El &amp; VVS AB</span>
          </p>
        </div>

        {/* Interactive sandbox */}
        <DemoSandbox examples={DEMO_EXAMPLES} />
      </div>
    </main>
  );
}
