import { Navbar } from "./v2/_components/Navbar";
import { Hero } from "./v2/_components/Hero";
import { Why } from "./v2/_components/Why";
import { HowItWorks } from "./v2/_components/HowItWorks";
import { Features } from "./v2/_components/Features";
import { Security } from "./v2/_components/Security";
import { Pricing } from "./v2/_components/Pricing";
import { FAQContact } from "./v2/_components/FAQContact";
import { LegalFooter } from "@/components/layout/LegalFooter";

export default function Home() {
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
