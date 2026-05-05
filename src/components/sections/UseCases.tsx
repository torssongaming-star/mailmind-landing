"use client";

import { motion } from "framer-motion";
import { Shirt, ShoppingBag, Building, Wrench, Stethoscope, Store, Headset, Truck } from "lucide-react";
import { Section } from "@/components/ui/section";
import { GradientCard } from "@/components/design-system/GradientCard";
import { Badge } from "@/components/ui/badge";

export function UseCases() {
  const industries = [
    {
      icon: <ShoppingBag className="w-5 h-5" />,
      title: "E-commerce",
      description: "Answer order queries, process returns and handle product questions.",
      tags: ["Order Status", "Returns", "Product Info"]
    },
    {
      icon: <Headset className="w-5 h-5" />,
      title: "Customer support",
      description: "Triage tickets, route to the right department, draft standard replies.",
      tags: ["Triage", "Routing", "Support"]
    },
    {
      icon: <Truck className="w-5 h-5" />,
      title: "Logistics",
      description: "Update customers on delays, missing packages and customs clearance.",
      tags: ["Tracking", "Delay", "Customs"]
    },
    {
      icon: <Building className="w-5 h-5" />,
      title: "Property service",
      description: "Manage maintenance requests, tenant complaints and lease questions.",
      tags: ["Maintenance", "Complaint", "Lease"]
    },
    {
      icon: <Wrench className="w-5 h-5" />,
      title: "Repair shops",
      description: "Send cost estimates, give status updates and manage bookings.",
      tags: ["Status", "Estimate", "Booking"]
    },
    {
      icon: <Stethoscope className="w-5 h-5" />,
      title: "Clinics",
      description: "Handle rescheduling, pre-visit instructions and billing queries.",
      tags: ["Reschedule", "Billing", "Instructions"]
    },
    {
      icon: <Store className="w-5 h-5" />,
      title: "Local services",
      description: "Quote jobs, schedule visits and answer common service questions.",
      tags: ["Quote", "Scheduling", "FAQ"]
    },
    {
      icon: <Shirt className="w-5 h-5" />,
      title: "Textile service",
      description: "Handle pickup times, missing items, delivery and invoice questions.",
      tags: ["Pickup", "Delivery", "Invoice"]
    },
  ];

  return (
    <Section className="border-b border-white/5 overflow-hidden">
      <div className="text-center max-w-4xl mx-auto mb-10 md:mb-20">
        <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6 tracking-tight leading-snug">Built for companies that handle real customer questions</h2>
        <p className="text-muted-foreground text-base md:text-xl leading-relaxed">
          Mailmind adapts to your industry workflow and learns from your responses.
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
