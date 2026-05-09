"use client";

import { Section } from "@/components/ui/section";
import { PricingCard } from "@/components/design-system/PricingCard";
import { PLAN_LIST } from "@/lib/plans";

export function Pricing() {
  const plans = PLAN_LIST;

  return (
    <Section id="pricing" className="border-b border-white/5 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="text-center max-w-4xl mx-auto mb-10 md:mb-20 relative z-10">
        <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6 tracking-tight leading-snug">Simple pricing for teams that want to move faster</h2>
        <p className="text-muted-foreground text-base md:text-xl leading-relaxed">
          Start small. Upgrade when your email volume grows.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-8 max-w-[90rem] mx-auto relative z-10 mb-10 md:mb-16 items-start">
        {plans.map((plan, index) => (
          <div key={index} className={plan.popular ? "mt-4 lg:mt-0 lg:-mt-4" : ""}>
            <PricingCard
              name={plan.name}
              price={plan.price}
              description={plan.description}
              features={plan.features}
              popular={plan.popular}
              ctaText={plan.ctaText}
              delay={index * 0.15}
            />
          </div>
        ))}
      </div>
      
      <div className="text-center relative z-10 max-w-2xl mx-auto">
        <p className="text-xs md:text-sm text-muted-foreground bg-white/[0.02] border border-white/5 py-3 px-4 md:px-6 rounded-full inline-block leading-relaxed">
          No long contracts. Cancel anytime. Usage limits can be adjusted as your team grows.
        </p>
      </div>
    </Section>
  );
}
