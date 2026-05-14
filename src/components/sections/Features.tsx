"use client";

import { Sparkles, FileText, Tag, MessageCircle, Inbox, Globe, BookOpen, ShieldCheck } from "lucide-react";
import { Section } from "@/components/ui/section";
import { FeatureCard } from "@/components/design-system/FeatureCard";

import { useI18n } from "@/lib/i18n";

export function Features() {
  const { t } = useI18n();

  const features = [
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: t("landing.features.draftsTitle"),
      description: t("landing.features.draftsDesc")
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: t("landing.features.summariesTitle"),
      description: t("landing.features.summariesDesc")
    },
    {
      icon: <Tag className="w-6 h-6" />,
      title: t("landing.features.categorizationTitle"),
      description: t("landing.features.categorizationDesc")
    },
    {
      icon: <MessageCircle className="w-6 h-6" />,
      title: t("landing.features.toneTitle"),
      description: t("landing.features.toneDesc")
    },
    {
      icon: <Inbox className="w-6 h-6" />,
      title: t("landing.features.sharedTitle"),
      description: t("landing.features.sharedDesc")
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: t("landing.features.multilingualTitle"),
      description: t("landing.features.multilingualDesc")
    },
    {
      icon: <BookOpen className="w-6 h-6" />,
      title: t("landing.features.knowledgeTitle"),
      description: t("landing.features.knowledgeDesc")
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: t("landing.features.approvalTitle"),
      description: t("landing.features.approvalDesc")
    }
  ];

  return (
    <Section id="features" className="border-b border-white/5 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="text-center max-w-4xl mx-auto mb-10 md:mb-20 relative z-10">
        <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6 tracking-tight leading-snug">{t("landing.features.title")}</h2>
        <p className="text-muted-foreground text-base md:text-xl leading-relaxed">
          {t("landing.features.description")}
        </p>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 relative z-10">
        {features.map((feature, index) => (
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
