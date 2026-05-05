import Link from "next/link";
import { Mail } from "lucide-react";
import { siteConfig } from "@/config/site";

const productLinks = [
  { href: "#features",    label: "Features"    },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing",     label: "Pricing"     },
  { href: "#security",    label: "Security"    },
  { href: "#faq",         label: "FAQ"         },
];

const companyLinks = [
  { href: "#contact", label: "Book a demo" },
  { href: "#contact", label: "Contact"     },
];

function FooterLinkGroup({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">{title}</h4>
      <ul className="space-y-0.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="block py-2 text-sm text-muted-foreground hover:text-white active:text-primary transition-colors focus-visible:outline-none focus-visible:text-primary"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="relative pt-12 md:pt-20 pb-8 md:pb-10 border-t border-white/5 overflow-hidden">
      {/* Top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-[1px] bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-20 bg-primary/5 blur-[40px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-6 md:px-8 relative z-10 max-w-7xl">

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 lg:gap-8 mb-10 md:mb-16">

          {/* Brand — full width on mobile, 2 cols on desktop */}
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="flex items-center gap-2.5 mb-4 w-fit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-lg"
              aria-label={`${siteConfig.siteName} homepage`}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                <Mail size={15} />
              </div>
              <span className="font-bold text-lg tracking-tight text-white">{siteConfig.siteName}</span>
            </Link>

            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {siteConfig.description}
            </p>
          </div>

          {/* Link groups — 2-col on mobile, 1-col each on desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-2 lg:col-span-2 gap-8">
            <FooterLinkGroup title="Product" links={productLinks} />
            <FooterLinkGroup title="Company" links={companyLinks} />
          </div>
        </div>

        {/* ── Copyright ── */}
        <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {siteConfig.siteName}. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground/60">
            Built for European teams.
          </p>
        </div>

      </div>
    </footer>
  );
}
