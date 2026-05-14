"use client";

import { Section } from "@/components/ui/section";
import { ProductMockup } from "@/components/design-system/ProductMockup";
import { useI18n } from "@/lib/i18n/context";

export function Demo() {
  const { t } = useI18n();
  return (
    <Section id="demo" className="overflow-hidden border-b border-white/5">
      
      <div className="text-center max-w-4xl mx-auto mb-8 md:mb-16 relative z-10">
        <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6 tracking-tight leading-snug">{t("landing.demo.title")}</h2>
        <p className="text-muted-foreground text-base md:text-xl leading-relaxed">
          {t("landing.demo.description")}
        </p>
      </div>


      <div className="relative z-10">
        <ProductMockup />
      </div>
    </Section>
  );
}
