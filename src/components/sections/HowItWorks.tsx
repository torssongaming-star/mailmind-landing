"use client";

import { motion } from "framer-motion";
import { Section } from "@/components/ui/section";

import { useI18n } from "@/lib/i18n/context";

export function HowItWorks() {
  const { t } = useI18n();

  const steps = [
    {
      number: "1",
      title: t("landing.howItWorks.step1Title"),
      description: t("landing.howItWorks.step1Desc"),
    },
    {
      number: "2",
      title: t("landing.howItWorks.step2Title"),
      description: t("landing.howItWorks.step2Desc"),
    },
    {
      number: "3",
      title: t("landing.howItWorks.step3Title"),
      description: t("landing.howItWorks.step3Desc"),
    },
    {
      number: "4",
      title: t("landing.howItWorks.step4Title"),
      description: t("landing.howItWorks.step4Desc"),
    },
  ];

  return (
    <Section id="how-it-works" className="border-b border-white/5 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="text-center max-w-4xl mx-auto mb-10 md:mb-24 relative z-10">
        <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6 tracking-tight leading-snug">{t("landing.howItWorks.title")}</h2>
        <p className="text-muted-foreground text-base md:text-xl leading-relaxed">
          {t("landing.howItWorks.description")}
        </p>
      </div>


      <div className="relative max-w-6xl mx-auto z-10">
        {/* Connecting line for desktop (horizontal) */}
        <div className="hidden lg:block absolute top-[3rem] left-[12.5%] right-[12.5%] h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        
        {/* Connecting line for mobile/tablet (vertical) */}
        <div className="block lg:hidden absolute top-12 bottom-12 left-12 w-[2px] bg-gradient-to-b from-transparent via-primary/30 to-transparent" />

        <div className="grid lg:grid-cols-4 gap-8 md:gap-12 lg:gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className="relative flex flex-row lg:flex-col items-start lg:items-center text-left lg:text-center group gap-8 lg:gap-0"
            >
              <div className="w-24 h-24 shrink-0 rounded-full bg-[#050B1C] border border-primary/30 flex items-center justify-center text-3xl font-bold text-primary lg:mb-8 shadow-[inset_0_0_20px_rgba(6,182,212,0.15),0_0_30px_rgba(6,182,212,0.15)] group-hover:scale-110 group-hover:border-primary/60 group-hover:text-cyan-300 group-hover:shadow-[inset_0_0_30px_rgba(6,182,212,0.3),0_0_50px_rgba(6,182,212,0.3)] transition-all duration-500 z-10 backdrop-blur-md relative">
                <span className="relative z-10">{step.number}</span>
                {/* Extra inner glow on hover */}
                <div className="absolute inset-0 rounded-full bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md" />
              </div>
              
              <div className="pt-6 lg:pt-0">
                <h3 className="text-xl md:text-2xl font-bold mb-3 tracking-wide">{step.title}</h3>
                <p className="text-muted-foreground text-base leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}
