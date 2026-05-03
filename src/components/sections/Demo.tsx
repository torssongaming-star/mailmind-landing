"use client";

import { Section } from "@/components/ui/section";
import { ProductMockup } from "@/components/design-system/ProductMockup";

export function Demo() {
  return (
    <Section id="demo" className="bg-[#030614] overflow-hidden border-b border-white/5">
      <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
      
      <div className="text-center max-w-4xl mx-auto mb-20 relative z-10">
        <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">See Mailmind in action</h2>
        <p className="text-muted-foreground text-xl leading-relaxed">
          See how Mailmind turns a customer email into a summarized thread, categorized request and AI-drafted reply ready for review.
        </p>
      </div>

      <div className="relative z-10">
        <ProductMockup />
      </div>
    </Section>
  );
}
