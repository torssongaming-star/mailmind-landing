"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Section } from "@/components/ui/section";
import { HeroMockup } from "@/components/design-system/HeroMockup";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

export function Hero() {
  const { t } = useI18n();

  return (
    <Section className="min-h-screen flex items-center overflow-hidden !py-0 border-b border-white/5">

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-8 items-center w-full relative z-10 pt-24 pb-10 lg:pt-0 lg:pb-0">
        
        {/* Left Column: Text & CTA */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-4 md:mb-8"
          >
            <Badge variant="glass" className="px-4 py-1.5 text-xs md:text-sm">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              {t("landing.hero.badge")}
            </Badge>
          </motion.div>
 
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4 md:mb-6 text-white leading-[1.15] md:leading-[1.1]"
          >
            {t("landing.hero.title")}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">{t("landing.hero.titleAccent")}</span>
          </motion.h1>
 
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base md:text-xl text-muted-foreground mb-6 md:mb-10 max-w-2xl leading-relaxed"
          >
            {t("landing.hero.description")}
          </motion.p>
 
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5 md:mb-8 w-full sm:w-auto"
          >
            <Button size="lg" className="w-full sm:w-auto gap-2 text-base h-14 px-8 shadow-[0_0_20px_rgba(6,182,212,0.25)]" asChild>
              <Link href="/signup">{t("landing.hero.getStarted")} <ArrowRight size={18} /></Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 text-base h-14 px-8 border-white/10 bg-white/[0.03]" asChild>
              <Link href="#demo">{t("landing.hero.viewProduct")}</Link>
            </Button>
          </motion.div>
 
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex items-center justify-center lg:justify-start gap-2 text-xs md:text-sm text-muted-foreground"
          >
            <ShieldCheck size={14} className="text-primary/70 shrink-0" />
            <span>{t("landing.hero.compliance")}</span>

          </motion.div>
        </div>


        {/* Right Column: Interactive Mockup */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="w-full mt-6 lg:mt-0"
        >
          <HeroMockup />
        </motion.div>

      </div>
    </Section>
  );
}
