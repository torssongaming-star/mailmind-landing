"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Send } from "lucide-react";

export function Contact() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder submit handler
    alert("Thanks for your interest! We'll be in touch soon.");
  };

  return (
    <Section id="contact" className="bg-[#030614] border-b border-white/5 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[500px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-2xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Book a Demo</h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            See how Mailmind can transform your customer email support. Tell us a bit about your current setup, and we'll show you exactly how much time you could save.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="bg-[#050B1C]/80 border border-white/10 rounded-2xl p-8 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.3)] backdrop-blur-xl"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="fullName" className="text-sm font-medium text-white/90">Full name</label>
                <input 
                  type="text" 
                  id="fullName" 
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="workEmail" className="text-sm font-medium text-white/90">Work email</label>
                <input 
                  type="email" 
                  id="workEmail" 
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  placeholder="jane@company.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="companyName" className="text-sm font-medium text-white/90">Company name</label>
                <input 
                  type="text" 
                  id="companyName" 
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  placeholder="Acme Corp"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="companyWebsite" className="text-sm font-medium text-white/90">Company website</label>
                <input 
                  type="url" 
                  id="companyWebsite" 
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  placeholder="https://acme.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="emailVolume" className="text-sm font-medium text-white/90">Approximate customer emails per week</label>
              <select 
                id="emailVolume" 
                className="w-full bg-[#050B1C] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none"
              >
                <option value="<100">Less than 100</option>
                <option value="100-500">100 - 500</option>
                <option value="500-2000">500 - 2,000</option>
                <option value="2000+">More than 2,000</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="currentSystem" className="text-sm font-medium text-white/90">Current email system</label>
              <select 
                id="currentSystem" 
                className="w-full bg-[#050B1C] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none"
              >
                <option value="outlook">Outlook / Microsoft 365</option>
                <option value="gmail">Gmail / Google Workspace</option>
                <option value="imap">Standard IMAP</option>
                <option value="other">Other / Helpdesk Software</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="message" className="text-sm font-medium text-white/90">Message (Optional)</label>
              <textarea 
                id="message" 
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none custom-scrollbar"
                placeholder="Anything specific you'd like to see on the demo?"
              />
            </div>

            <Button type="submit" size="lg" className="w-full h-14 text-base gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
              Submit Request <Send size={18} />
            </Button>
          </form>
        </motion.div>
      </div>
    </Section>
  );
}
