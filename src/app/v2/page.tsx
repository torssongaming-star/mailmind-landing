import { Navbar } from "./_components/Navbar";
import { Hero } from "./_components/Hero";
import { Why } from "./_components/Why";
import { HowItWorks } from "./_components/HowItWorks";
import { Features } from "./_components/Features";
import { Security } from "./_components/Security";
import { Pricing } from "./_components/Pricing";
import { FAQContact } from "./_components/FAQContact";
import { LegalFooter } from "@/components/layout/LegalFooter";

export default function V2Page() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Why />
        <HowItWorks />
        <Features />
        <Security />
        <Pricing />
        <FAQContact />
      </main>
      <LegalFooter />
    </>
  );
}
