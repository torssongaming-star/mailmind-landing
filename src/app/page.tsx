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

  return (
    <>
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
    </>
  );
}
