"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section } from "@/components/ui/section";
import { useI18n } from "@/lib/i18n/context";

export function FAQ() {
  const { t } = useI18n();

  const faqs = [
    {
      question: t("landing.faq.q1"),
      answer: t("landing.faq.a1")
    },
    {
      question: t("landing.faq.q2"),
      answer: t("landing.faq.a2")
    },
    {
      question: t("landing.faq.q3"),
      answer: t("landing.faq.a3")
    },
    {
      question: t("landing.faq.q4"),
      answer: t("landing.faq.a4")
    },
    {
      question: t("landing.faq.q5"),
      answer: t("landing.faq.a5")
    },
    {
      question: t("landing.faq.q6"),
      answer: t("landing.faq.a6")
    },
    {
      question: t("landing.faq.q7"),
      answer: t("landing.faq.a7")
    }
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <Section id="faq" className="border-b border-white/5 relative">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10 md:mb-20">
          <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6 tracking-tight leading-snug">{t("landing.faq.title")}</h2>
          <p className="text-muted-foreground text-base md:text-xl leading-relaxed">
            {t("landing.faq.description")}
          </p>
        </div>


        <div className="space-y-4 md:space-y-6">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02] backdrop-blur-md hover:bg-white/[0.04] transition-colors shadow-[0_0_15px_rgba(0,0,0,0.2)]"
            >
              <button
                className="w-full flex items-center justify-between p-5 md:p-8 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="font-semibold text-base md:text-xl tracking-wide pr-4">{faq.question}</span>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300",
                  openIndex === index ? "bg-primary text-primary-foreground border-transparent shadow-[0_0_10px_rgba(6,182,212,0.5)] rotate-180" : "border-white/10 text-muted-foreground bg-white/5"
                )}>
                  <ChevronDown className="w-5 h-5" />
                </div>
              </button>
              
              <div 
                className={cn(
                  "overflow-hidden transition-all duration-300 ease-in-out",
                  openIndex === index ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                )}
              >
                <div className="p-5 pt-0 md:p-8 md:pt-0 text-muted-foreground text-sm md:text-base leading-relaxed border-t border-white/5">
                  {faq.answer}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}
