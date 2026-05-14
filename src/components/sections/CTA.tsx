"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { useI18n } from "@/lib/i18n/context";

export function CTA() {
  const { t } = useI18n();

  return (
    <Section className="relative overflow-hidden border-b border-white/5 !py-14 md:!py-32">
      {/* Central glow behind CTA */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-[2.5rem] border border-white/10 bg-[#050B1C]/80 backdrop-blur-xl p-8 md:p-20 shadow-[0_0_50px_rgba(0,0,0,0.5),inset_0_0_20px_rgba(6,182,212,0.05)]"
        >
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-6 tracking-tight leading-snug md:leading-tight">
            {t("landing.cta.title")}
          </h2>
          
          <p className="text-muted-foreground text-base md:text-xl mb-8 md:mb-10 max-w-2xl mx-auto leading-relaxed">
            {t("landing.cta.description")}
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="w-full sm:w-auto gap-2 text-base h-14 px-10 shadow-[0_0_20px_rgba(6,182,212,0.3)]" asChild>
              <Link href="#contact">{t("landing.cta.bookDemo")} <ArrowRight size={18} /></Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 text-base h-14 px-10 border-white/10 hover:bg-white/5" asChild>
              <Link href="#contact">{t("landing.cta.contactUs")}</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}

