import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: { default: "Juridik | Mailmind", template: "%s | Juridik · Mailmind" },
};

const NAV = [
  { href: "/terms",                label: "Användarvillkor" },
  { href: "/privacy",              label: "Integritetspolicy" },
  { href: "/cookies",              label: "Cookies" },
  { href: "/legal/dpa",            label: "Personuppgiftsbiträdesavtal (DPA)" },
  { href: "/legal/sub-processors", label: "Underbiträden" },
  { href: "/legal/aup",            label: "Acceptabel användning" },
  { href: "/legal/sla",            label: "SLA" },
  { href: "/legal/refund",         label: "Återbetalning" },
  { href: "/legal/msa",            label: "MSA (för enterprise)" },
  { href: "/security",             label: "Säkerhet" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[hsl(var(--surface-base))] text-white">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16 grid md:grid-cols-[220px_1fr] gap-8 md:gap-12">
        {/* Sidebar */}
        <aside className="md:sticky md:top-12 md:self-start space-y-1">
          <Link href="/" className="block text-xs uppercase tracking-widest text-white/40 hover:text-white/70 mb-4 transition-colors">
            ← Tillbaka till {siteConfig.siteName}
          </Link>
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold px-2 py-2">
            Juridiska dokument
          </p>
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-1.5 rounded-lg text-[13px] text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </aside>

        {/* Content */}
        <article className="min-w-0 prose prose-invert max-w-none
          prose-headings:tracking-tight
          prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-2
          prose-h2:text-xl  prose-h2:mt-10 prose-h2:mb-3
          prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2 prose-h3:font-semibold
          prose-p:text-white/75 prose-p:leading-relaxed
          prose-strong:text-white
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-li:text-white/75 prose-li:my-1
          prose-table:text-sm prose-th:text-white prose-th:font-semibold
          prose-td:text-white/70 prose-td:border-white/10 prose-th:border-white/10
          prose-code:text-cyan-300 prose-code:bg-white/5 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
        ">
          {children}
        </article>
      </div>
    </main>
  );
}
