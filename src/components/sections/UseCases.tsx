"use client";

import { motion } from "framer-motion";
import { Shirt, ShoppingBag, Building, Wrench, Stethoscope, Store, Headset, Truck } from "lucide-react";
import { Section } from "@/components/ui/section";
import { GradientCard } from "@/components/design-system/GradientCard";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";

export function UseCases() {
  const { t, getRaw } = useI18n();

  const industries = [
    {
      icon: <ShoppingBag className="w-5 h-5" />,
      title: t("landing.useCases.ecommerce"),
      description: t("landing.useCases.ecommerceDesc"),
      tags: getRaw("landing.useCases.ecommerceTags") || []
    },
    {
      icon: <Headset className="w-5 h-5" />,
      title: t("landing.useCases.support"),
      description: t("landing.useCases.supportDesc"),
      tags: getRaw("landing.useCases.supportTags") || []
    },
    {
      icon: <Truck className="w-5 h-5" />,
      title: t("landing.useCases.logistics"),
      description: t("landing.useCases.logisticsDesc"),
      tags: getRaw("landing.useCases.logisticsTags") || []
    },
    {
      icon: <Building className="w-5 h-5" />,
      title: t("landing.useCases.property"),
      description: t("landing.useCases.propertyDesc"),
      tags: getRaw("landing.useCases.propertyTags") || []
    },
    {
      icon: <Wrench className="w-5 h-5" />,
      title: t("landing.useCases.repair"),
      description: t("landing.useCases.repairDesc"),
      tags: getRaw("landing.useCases.repairTags") || []
    },
    {
      icon: <Stethoscope className="w-5 h-5" />,
      title: t("landing.useCases.clinics"),
      description: t("landing.useCases.clinicsDesc"),
      tags: getRaw("landing.useCases.clinicsTags") || []
    },
    {
      icon: <Store className="w-5 h-5" />,
      title: t("landing.useCases.services"),
      description: t("landing.useCases.servicesDesc"),
      tags: getRaw("landing.useCases.servicesTags") || []
    },
    {
      icon: <Shirt className="w-5 h-5" />,
      title: t("landing.useCases.textile"),
      description: t("landing.useCases.textileDesc"),
      tags: getRaw("landing.useCases.textileTags") || []
    },
  ];

  return (
    <Section className="border-b border-white/5 overflow-hidden">
      <div className="text-center max-w-4xl mx-auto mb-10 md:mb-20">
        <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6 tracking-tight leading-snug">{t("landing.useCases.title")}</h2>
        <p className="text-muted-foreground text-base md:text-xl leading-relaxed">
          {t("landing.useCases.description")}
        </p>
      </div>


      {/* 2-col on mobile, 2-col on md, 4-col on lg */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {industries.map((industry, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: Math.min(index * 0.07, 0.3) }}
            className="group"
          >
            <GradientCard
              innerClassName="p-4 md:p-6 flex flex-col h-full bg-[#030614]/90"
              className="h-full active:scale-[0.98] hover:scale-[1.02] hover:-translate-y-1 transition-transform duration-300 transform-gpu"
            >
              {/* Icon + title inline on mobile */}
              <div className="flex items-start gap-2.5 mb-3">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 [&_svg]:w-4 [&_svg]:h-4 shadow-[inset_0_0_10px_rgba(6,182,212,0.1)] group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                  {industry.icon}
                </div>
                <h3 className="font-bold text-xs md:text-base leading-snug text-white pt-0.5">{industry.title}</h3>
              </div>

              <p className="text-muted-foreground text-xs md:text-sm leading-relaxed mb-3 flex-1">
                {industry.description}
              </p>

              {/* Tags always visible — not hover-dependent */}
              <div className="flex flex-wrap gap-1 mt-auto">
                {industry.tags.map((tag, tagIndex) => (
                  <Badge
                    key={tagIndex}
                    variant="outline"
                    className="text-[9px] md:text-[10px] bg-white/[0.02] border-primary/20 text-primary/70 font-medium"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </GradientCard>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
