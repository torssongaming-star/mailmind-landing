"use client";

import { Shield, Lock, UserCheck, History, Globe, BrainCircuit } from "lucide-react";
import { Section } from "@/components/ui/section";
import { FeatureCard } from "@/components/design-system/FeatureCard";

import { useI18n } from "@/lib/i18n/context";

export function Security() {
  const { t } = useI18n();

  const securityFeatures = [
    {
      icon: <UserCheck className="w-6 h-6" />,
      title: t("landing.security.humanTitle"),
      description: t("landing.security.humanDesc")
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: t("landing.security.gdprTitle"),
      description: t("landing.security.gdprDesc")
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: t("landing.security.accessTitle"),
      description: t("landing.security.accessDesc")
    },
    {
      icon: <History className="w-6 h-6" />,
      title: t("landing.security.auditTitle"),
      description: t("landing.security.auditDesc")
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: t("landing.security.euTitle"),
      description: t("landing.security.euDesc")
    },
    {
      icon: <BrainCircuit className="w-6 h-6" />,
      title: t("landing.security.decisionsTitle"),
      description: t("landing.security.decisionsDesc")
    }
  ];

  return (
    <Section id="security" className="border-b border-white/5 relative overflow-hidden">
      {/* Subtle, non-flashy background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="text-center max-w-4xl mx-auto mb-8 md:mb-16 relative z-10">
        <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6 tracking-tight leading-snug">{t("landing.security.title")}</h2>
        <p className="text-muted-foreground text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
          {t("landing.security.description")}
        </p>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 relative z-10 max-w-5xl mx-auto">
        {securityFeatures.map((feature, index) => (
          <FeatureCard
            key={index}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
            delay={index * 0.1}
          />
        ))}
      </div>
    </Section>
  );
}
