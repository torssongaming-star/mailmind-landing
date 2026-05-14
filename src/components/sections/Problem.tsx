"use client";

import { motion } from "framer-motion";
import { Clock, Inbox, Repeat } from "lucide-react";
import { Section } from "@/components/ui/section";
import { FeatureCard } from "@/components/design-system/FeatureCard";

import { useI18n } from "@/lib/i18n";

export function Problem() {
  const { t } = useI18n();

  const problems = [
    {
      icon: <Repeat className="w-6 h-6" />,
      title: t("landing.problem.repeatTitle"),
      description: t("landing.problem.repeatDesc"),
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: t("landing.problem.slowTitle"),
      description: t("landing.problem.slowDesc"),
    },
    {
      icon: <Inbox className="w-6 h-6" />,
      title: t("landing.problem.buriedTitle"),
      description: t("landing.problem.buriedDesc"),
    },
  ];

  return (
    <Section className="border-b border-white/5">
      <div className="text-center max-w-4xl mx-auto mb-8 md:mb-16">
        <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6 tracking-tight leading-snug">{t("landing.problem.title")}</h2>
        <p className="text-muted-foreground text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
          {t("landing.problem.description")}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-5 md:gap-8 mb-10 md:mb-20">
        {problems.map((problem, index) => (
          <FeatureCard
            key={index}
            icon={problem.icon}
            title={problem.title}
            description={problem.description}
            delay={index * 0.15}
          />
        ))}
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="text-center max-w-3xl mx-auto"
      >
        <p className="text-2xl md:text-3xl font-semibold tracking-tight text-white/90 leading-snug">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">Mailmind</span> {t("landing.problem.aiWorkspace")}
        </p>
      </motion.div>
    </Section>
  );
}

