"use client";

import { Sparkles, FileText, Tag, MessageCircle, Inbox, Globe, BookOpen, ShieldCheck } from "lucide-react";
import { Section } from "@/components/ui/section";
import { FeatureCard } from "@/components/design-system/FeatureCard";

export function Features() {
  const features = [
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: "AI reply drafts",
      description: "Generate accurate response drafts based on your company information."
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: "Thread summaries",
      description: "Understand long conversations without reading every message."
    },
    {
      icon: <Tag className="w-6 h-6" />,
      title: "Automatic categorization",
      description: "Detect complaints, order questions, invoices, bookings and more."
    },
    {
      icon: <MessageCircle className="w-6 h-6" />,
      title: "Company tone of voice",
      description: "Replies sound like your business, not like a generic chatbot."
    },
    {
      icon: <Inbox className="w-6 h-6" />,
      title: "Shared inbox",
      description: "Work together in one organized customer email workspace."
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: "Multilingual support",
      description: "Handle customer emails across European languages."
    },
    {
      icon: <BookOpen className="w-6 h-6" />,
      title: "Templates & knowledge base",
      description: "Use your policies, prices, FAQs and standard replies as AI context."
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: "Human approval",
      description: "Your team stays in control before anything reaches the customer."
    }
  ];

  return (
    <Section id="features" className="border-b border-white/5 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="text-center max-w-4xl mx-auto mb-10 md:mb-20 relative z-10">
        <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6 tracking-tight leading-snug">Everything your team needs to answer faster</h2>
        <p className="text-muted-foreground text-base md:text-xl leading-relaxed">
          Powerful features designed specifically for modern customer support teams.
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
