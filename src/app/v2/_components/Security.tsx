"use client";

import { Lock, Globe, ShieldCheck, Eye } from "lucide-react";
import Link from "next/link";

const POINTS = [
  { icon: Lock,        title: "AES-256 + TLS 1.3",      body: "Kryptering i vila och under överföring. OAuth-tokens AES-GCM-krypterade." },
  { icon: Globe,       title: "Data i EU",              body: "Frankfurt-baserad databas. Standardklausuler för USA-leverantörer." },
  { icon: ShieldCheck, title: "GDPR by design",         body: "Personuppgiftsbiträdesavtal, audit-logg, retention-policy, dataexport." },
  { icon: Eye,         title: "Människa i loopen",      body: "AI:n föreslår — människa godkänner. Inget skickas autonomt utan ditt aktiva val." },
];

export function Security() {
  return (
    <section id="security" className="py-20 md:py-28 px-6 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-2">
            Säkerhet
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] text-white">
            Era kunders mejl
            <br />
            <span className="text-white/45">stannar säkra.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {POINTS.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={i}
                className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/40 backdrop-blur-sm p-5 flex items-start gap-4"
              >
                <div className="shrink-0 w-9 h-9 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center">
                  <Icon size={16} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white tracking-tight">{p.title}</h3>
                  <p className="text-[13px] text-white/55 leading-relaxed mt-1">{p.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/security"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            Läs hela säkerhetspolicyn →
          </Link>
        </div>
      </div>
    </section>
  );
}
