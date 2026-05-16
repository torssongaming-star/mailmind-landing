"use client";

/**
 * Compact legal footer with org info + links to all policies.
 * Renders on marketing pages — NOT on the portal app where it'd be noisy.
 *
 * Required by Swedish e-commerce law (e-handelslagen § 8) for B2B websites:
 * org name, org-nr, contact info must be visible.
 */

import Link from "next/link";
import { siteConfig } from "@/config/site";
import { openCookiePreferences } from "./CookieBanner";

export function LegalFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/8 bg-[hsl(var(--surface-deep))]/40 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Company */}
          <div className="col-span-2 md:col-span-1">
            <p className="text-sm font-semibold text-white">{siteConfig.siteName}</p>
            <address className="not-italic text-xs text-white/50 mt-2 leading-relaxed">
              {/* TODO: ersätt med riktigt företagsnamn + org-nr när bolaget är registrerat */}
              [BOLAGSNAMN AB]<br />
              Org-nr: [XXXXXX-XXXX]<br />
              [GATUADRESS]<br />
              [POSTNR] [STAD]<br />
              <a href={`mailto:${siteConfig.supportEmail ?? "hej@mailmind.se"}`} className="text-primary hover:underline">
                {siteConfig.supportEmail ?? "hej@mailmind.se"}
              </a>
            </address>
          </div>

          {/* Produkt */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-3">Produkt</p>
            <ul className="space-y-2 text-xs">
              <li><Link href="/#features" className="text-white/55 hover:text-white transition-colors">Funktioner</Link></li>
              <li><Link href="/#pricing" className="text-white/55 hover:text-white transition-colors">Priser</Link></li>
              <li><Link href="/security" className="text-white/55 hover:text-white transition-colors">Säkerhet</Link></li>
              <li><Link href="/app" className="text-white/55 hover:text-white transition-colors">Logga in</Link></li>
            </ul>
          </div>

          {/* Juridik */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-3">Juridik</p>
            <ul className="space-y-2 text-xs">
              <li><Link href="/terms" className="text-white/55 hover:text-white transition-colors">Användarvillkor</Link></li>
              <li><Link href="/privacy" className="text-white/55 hover:text-white transition-colors">Integritetspolicy</Link></li>
              <li><Link href="/legal/dpa" className="text-white/55 hover:text-white transition-colors">DPA</Link></li>
              <li><Link href="/legal/sub-processors" className="text-white/55 hover:text-white transition-colors">Underbiträden</Link></li>
              <li><Link href="/legal/aup" className="text-white/55 hover:text-white transition-colors">Acceptabel användning</Link></li>
              <li><Link href="/legal/sla" className="text-white/55 hover:text-white transition-colors">SLA</Link></li>
            </ul>
          </div>

          {/* Stöd */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-3">Stöd</p>
            <ul className="space-y-2 text-xs">
              <li><a href={`mailto:${siteConfig.supportEmail ?? "support@mailmind.se"}`} className="text-white/55 hover:text-white transition-colors">Support</a></li>
              <li><a href="mailto:dpo@mailmind.se" className="text-white/55 hover:text-white transition-colors">Dataskyddsombud</a></li>
              <li><a href="mailto:security@mailmind.se" className="text-white/55 hover:text-white transition-colors">Säkerhetsincidenter</a></li>
              <li>
                <button
                  onClick={openCookiePreferences}
                  className="text-white/55 hover:text-white transition-colors text-left"
                >
                  Cookie-inställningar
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/35">
          <p>© {year} [BOLAGSNAMN AB]. Alla rättigheter förbehållna.</p>
          <p className="flex items-center gap-3">
            <span>Byggd i Sverige</span>
            <span className="text-white/20">·</span>
            <span>Data i EU</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
