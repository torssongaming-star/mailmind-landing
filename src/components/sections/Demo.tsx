"use client";

import { Section } from "@/components/ui/section";
import { ProductMockup } from "@/components/design-system/ProductMockup";

export function Demo() {
  return (
    <Section className="bg-[#030614] overflow-hidden border-b border-white/5">
      <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
      
      <div className="text-center max-w-4xl mx-auto mb-20 relative z-10">
        <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">See Mailmind in action</h2>
        <p className="text-muted-foreground text-xl leading-relaxed">
          A beautiful, native-feeling dashboard that connects to your existing inbox and supercharges your team with AI.
        </p>
      </div>

      <div className="relative z-10">
        <ProductMockup />
      </div>
    </Section>
  );
}
