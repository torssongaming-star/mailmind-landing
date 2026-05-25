import { headers } from "next/headers";
import { Navbar } from "./v2/_components/Navbar";
import { Hero } from "./v2/_components/Hero";
import { Why } from "./v2/_components/Why";
import { HowItWorks } from "./v2/_components/HowItWorks";
import { Features } from "./v2/_components/Features";
import { Security } from "./v2/_components/Security";
import { Pricing } from "./v2/_components/Pricing";
import { FAQContact } from "./v2/_components/FAQContact";
import { LegalFooter } from "@/components/layout/LegalFooter";
import type { Currency } from "@/lib/plans";

// Force dynamic rendering so the geo-detect runs per-request
export const dynamic = "force-dynamic";

/**
 * Detect the visitor's currency from Vercel's geo-IP header.
 * SE → SEK, everything else → EUR.
 *
 * Vercel injects `x-vercel-ip-country` automatically when deployed.
 * In local dev it's missing, so we default to SEK (we're Swedish-first).
 */
async function detectCurrency(): Promise<Currency> {
  const h = await headers();
  const country = h.get("x-vercel-ip-country");
  if (!country) return "SEK";          // local dev → default to home market
  return country === "SE" ? "SEK" : "EUR";
}

export default async function Home() {
  const currency = await detectCurrency();

  // Samma subtila radial-bakgrund som /v2/layout.tsx — täcker root-layoutens
  // utrymme (där RouteAwareAnimatedBackground nu hoppar över "/") så
  // v2-komponenterna får den lugna bakgrund de designats för.
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
      <div
        className="fixed inset-0 pointer-events-none -z-10 opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
        aria-hidden
      />
      <Navbar />
      <main>
        <Hero />
        <Why />
        <HowItWorks />
        <Features />
        <Security />
        <Pricing currency={currency} />
        <FAQContact />
      </main>
      <LegalFooter />
    </div>
  );
}
