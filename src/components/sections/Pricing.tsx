"use client";

import { Section } from "@/components/ui/section";
import { PricingCard } from "@/components/design-system/PricingCard";

export function Pricing() {
  const plans = [
    {
      name: "Starter",
      price: "€19",
      description: "For small teams testing AI email support",
      features: [
        "1 inbox",
        "2 users",
        "500 AI drafts/month",
        "Email categorization",
        "Basic templates"
      ],
      ctaText: "Start with Starter"
    },
    {
      name: "Team",
      price: "€49",
      description: "For companies handling customer emails every day",
      features: [
        "3 inboxes",
        "5 users",
        "2,000 AI drafts/month",
        "Thread summaries",
        "Company tone of voice",
        "Shared inbox",
        "Basic analytics"
      ],
      popular: true,
      ctaText: "Book a demo"
    },
    {
      name: "Business",
      price: "€99",
      description: "For growing teams with higher volume",
      features: [
        "5 inboxes",
        "10 users",
        "5,000 AI drafts/month",
        "Advanced workflows",
        "Knowledge base",
        "Access control",
        "Audit history"
      ],
      ctaText: "Talk to sales"
    }
  ];

  return (
    <Section id="pricing" className="border-b border-white/5 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="text-center max-w-4xl mx-auto mb-10 md:mb-20 relative z-10">
        <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6 tracking-tight leading-snug">Simple pricing for teams that want to move faster</h2>
        <p className="text-muted-foreground text-base md:text-xl leading-relaxed">
          Start small. Upgrade when your email volume grows.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 md:gap-8 max-w-6xl mx-auto relative z-10 mb-10 md:mb-16 items-start">
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
