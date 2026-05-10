"use client";

import { Section } from "@/components/ui/section";
import { ProductMockup } from "@/components/design-system/ProductMockup";
import { siteConfig } from "@/config/site";

export function Demo() {
  return (
    <Section id="demo" className="overflow-hidden border-b border-white/5">
      
      <div className="text-center max-w-4xl mx-auto mb-8 md:mb-16 relative z-10">
        <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6 tracking-tight leading-snug">See {siteConfig.siteName} in action</h2>
        <p className="text-muted-foreground text-base md:text-xl leading-relaxed">
          See how {siteConfig.siteName} turns a customer email into a summarized thread, categorized request and AI-drafted reply ready for review.
        </p>
      </div>

      <div className="relative z-10">
        <ProductMockup />
      </div>
    </Section>
  );
}
