"use client";

import { motion } from "framer-motion";
import { UserCheck, Shield, Lock, History, Globe, BrainCircuit } from "lucide-react";
import { Section } from "@/components/ui/section";
import { FeatureCard } from "@/components/design-system/FeatureCard";

export function Security() {
  const securityFeatures = [
    {
      icon: <UserCheck className="w-6 h-6" />,
      title: "Human-in-the-loop",
      description: "AI drafts. Your team approves."
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "GDPR-focused workflows",
      description: "Clear data handling, retention controls and deletion options."
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: "Access control",
      description: "Limit who can view, edit and approve customer replies."
    },
    {
      icon: <History className="w-6 h-6" />,
      title: "Audit history",
      description: "Track important actions and AI-assisted responses."
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: "EU-ready setup",
      description: "Built for companies that need predictable data routines."
    },
    {
      icon: <BrainCircuit className="w-6 h-6" />,
      title: "No sensitive decisions by default",
      description: "AI helps write replies but does not make final customer decisions."
    }
  ];

  return (
    <Section id="security" className="bg-[#030614] border-b border-white/5 relative overflow-hidden">
      {/* Subtle, non-flashy background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="text-center max-w-4xl mx-auto mb-16 relative z-10">
        <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Designed for European businesses</h2>
        <p className="text-muted-foreground text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
          Customer emails often contain personal data. Mailmind is designed with European data protection expectations in mind, with clear controls, human approval and transparent AI usage.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10 max-w-5xl mx-auto">
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
