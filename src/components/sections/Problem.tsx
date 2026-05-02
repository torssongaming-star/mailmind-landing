"use client";

import { motion } from "framer-motion";
import { Clock, Inbox, Repeat } from "lucide-react";
import { Section } from "@/components/ui/section";
import { FeatureCard } from "@/components/design-system/FeatureCard";

export function Problem() {
  const problems = [
    {
      icon: <Repeat className="w-6 h-6" />,
      title: "Repeated questions",
      description: "Your team writes the same answers again and again.",
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: "Slow response times",
      description: "Customers wait because every email has to be read, understood and answered manually.",
    },
    {
      icon: <Inbox className="w-6 h-6" />,
      title: "No clear overview",
      description: "Important messages get buried in crowded inboxes.",
    },
  ];

  return (
    <Section className="border-b border-white/5 bg-[#01030B]">
      <div className="text-center max-w-4xl mx-auto mb-16">
        <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Customer email takes more time than it should</h2>
        <p className="text-muted-foreground text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
          Most teams answer the same questions every day: opening hours, order status, complaints, pricing, booking changes and delivery updates. The result is slower response times, stressed staff and inconsistent answers.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-20">
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
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">Mailmind</span> turns your inbox into an AI-assisted customer support workspace.
        </p>
      </motion.div>
    </Section>
  );
}
