"use client";

import { motion } from "framer-motion";
import { Shirt, ShoppingBag, Building, Wrench, Stethoscope, Store, Headset, Truck } from "lucide-react";
import { Section } from "@/components/ui/section";
import { GradientCard } from "@/components/design-system/GradientCard";
import { Badge } from "@/components/ui/badge";

export function UseCases() {
  const industries = [
    {
      icon: <Shirt className="w-5 h-5" />,
      title: "Laundry and textile service",
      description: "Handle pickup times, missing items, delivery updates and invoice questions faster.",
      tags: ["Pickup", "Missing item", "Delivery"]
    },
    {
      icon: <ShoppingBag className="w-5 h-5" />,
      title: "E-commerce",
      description: "Answer WISMO (where is my order), process returns, and handle product inquiries.",
      tags: ["Order Status", "Returns", "Product Info"]
    },
    {
      icon: <Building className="w-5 h-5" />,
      title: "Property and facility service",
      description: "Manage tenant complaints, maintenance requests, and contract questions efficiently.",
      tags: ["Maintenance", "Complaint", "Lease"]
    },
    {
      icon: <Wrench className="w-5 h-5" />,
      title: "Repair shops",
      description: "Provide status updates, send cost estimates, and manage booking requests.",
      tags: ["Status Update", "Estimate", "Booking"]
    },
    {
      icon: <Stethoscope className="w-5 h-5" />,
      title: "Clinics and appointments",
      description: "Handle rescheduling, provide pre-visit instructions, and answer billing queries.",
      tags: ["Reschedule", "Instructions", "Billing"]
    },
    {
      icon: <Store className="w-5 h-5" />,
      title: "Local service businesses",
      description: "Quote new jobs, schedule visits, and answer common questions about your services.",
      tags: ["Quote", "Scheduling", "FAQ"]
    },
    {
      icon: <Headset className="w-5 h-5" />,
      title: "Customer support teams",
      description: "Triage incoming tickets, route to the right department, and draft standard replies.",
      tags: ["Triage", "Routing", "Support"]
    },
    {
      icon: <Truck className="w-5 h-5" />,
      title: "Logistics and delivery",
      description: "Update customers on tracking delays, missing packages, and customs clearance.",
      tags: ["Tracking", "Delay", "Customs"]
    }
  ];

  return (
    <Section className="bg-[#01030B] border-b border-white/5 overflow-hidden">
      <div className="text-center max-w-4xl mx-auto mb-20 px-4">
        <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Built for companies that handle real customer questions</h2>
        <p className="text-muted-foreground text-xl leading-relaxed">
          Mailmind adapts to your specific industry workflow and learns from your historical responses.
        </p>
      </div>

      {/* Horizontal scroll on mobile, grid on desktop */}
      <div className="flex overflow-x-auto pb-8 md:pb-0 md:grid md:grid-cols-2 lg:grid-cols-4 gap-6 px-4 md:px-0 custom-scrollbar snap-x snap-mandatory">
        {industries.map((industry, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="min-w-[280px] w-[85vw] md:w-auto shrink-0 snap-center group perspective"
          >
            <GradientCard innerClassName="p-6 flex flex-col h-full bg-[#030614]/90" className="h-full hover:scale-[1.02] hover:-translate-y-1 transition-transform duration-300 transform-gpu">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300 shadow-[inset_0_0_10px_rgba(6,182,212,0.1)]">
                  {industry.icon}
                </div>
                <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{industry.title}</h3>
              </div>
              
              <p className="text-muted-foreground text-sm leading-relaxed mb-6 flex-1">
                {industry.description}
              </p>
              
              <div className="flex flex-wrap gap-1.5 mt-auto">
                {industry.tags.map((tag, tagIndex) => (
                  <Badge 
                    key={tagIndex} 
                    variant="outline" 
                    className="text-[10px] bg-white/[0.02] border-white/10 text-foreground/70 group-hover:border-primary/30 group-hover:text-primary/90 transition-colors"
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
