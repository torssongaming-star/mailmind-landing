"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Send, CheckCircle2, AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm md:text-base placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all";

const selectClass =
  "w-full bg-[#050B1C] border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all appearance-none";

const labelClass = "block text-xs md:text-sm font-medium text-white/80 mb-1.5";

function SuccessPanel({ onReset }: { onReset: () => void }) {
  return (
    <motion.div
      key="success"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center text-center py-8 md:py-12 gap-5"
    >
      <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.2)]">
        <CheckCircle2 className="w-8 h-8 text-green-400" />
      </div>
      <div>
        <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Request received!</h3>
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-sm">
          Thanks for your interest in Mailmind. We&apos;ll be in touch within one business day to schedule your demo.
        </p>
      </div>
      <button
        onClick={onReset}
        className="text-xs text-muted-foreground hover:text-white underline underline-offset-2 transition-colors mt-2"
      >
        Submit another request
      </button>
    </motion.div>
  );
}

function ContactForm({
  onSuccess,
  isError,
  setIsError,
}: {
  onSuccess: () => void;
  isError: boolean;
  setIsError: (v: boolean) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setIsError(false);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    if (process.env.NODE_ENV === "development") {
      console.log("Form submitted:", data);
    }

    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      onSuccess();
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.form
      key="form"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onSubmit={handleSubmit}
      className="space-y-5"
      noValidate
    >
      {/* Row 1: Name + Email */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label htmlFor="fullName" className={labelClass}>Full name</label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            required
            autoComplete="name"
            className={inputClass}
            placeholder="Jane Doe"
          />
        </div>
        <div>
          <label htmlFor="workEmail" className={labelClass}>Work email</label>
          <input
            type="email"
            id="workEmail"
            name="workEmail"
            required
            autoComplete="email"
            className={inputClass}
            placeholder="jane@company.com"
          />
        </div>
      </div>

      {/* Row 2: Company + Website */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label htmlFor="companyName" className={labelClass}>Company name</label>
          <input
            type="text"
            id="companyName"
            name="companyName"
            required
            autoComplete="organization"
            className={inputClass}
            placeholder="Acme Corp"
          />
        </div>
        <div>
          <label htmlFor="companyWebsite" className={labelClass}>
            Website <span className="text-white/50 font-normal">(optional)</span>
          </label>
          <input
            type="url"
            id="companyWebsite"
            name="companyWebsite"
            autoComplete="url"
            className={inputClass}
            placeholder="https://acme.com"
          />
        </div>
      </div>

      {/* Email volume */}
      <div>
        <label htmlFor="emailVolume" className={labelClass}>Approx. customer emails per week</label>
        <div className="relative">
          <select id="emailVolume" name="emailVolume" className={selectClass}>
            <option value="<100">Less than 100</option>
            <option value="100-500">100 – 500</option>
            <option value="500-2000">500 – 2,000</option>
            <option value="2000+">More than 2,000</option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
        </div>
      </div>

      {/* Current system */}
      <div>
        <label htmlFor="currentSystem" className={labelClass}>Current email system</label>
        <div className="relative">
          <select id="currentSystem" name="currentSystem" className={selectClass}>
            <option value="outlook">Outlook / Microsoft 365</option>
            <option value="gmail">Gmail / Google Workspace</option>
            <option value="imap">Standard IMAP</option>
            <option value="other">Other / Helpdesk Software</option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
        </div>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="message" className={labelClass}>
          Message <span className="text-white/50 font-normal">(optional)</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          className={`${inputClass} resize-none custom-scrollbar`}
          placeholder="Anything specific you'd like to see on the demo?"
        />
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {isError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-3 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Something went wrong. Please try again or email us directly.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        disabled={isLoading}
        className="w-full h-14 text-sm md:text-base font-semibold gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.45)] transition-shadow"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Submit Request
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground pt-1">
        We&apos;ll reply within one business day. No sales pressure.
      </p>
    </motion.form>
  );
}

export function Contact() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);

  return (
    <Section id="contact" className="border-b border-white/5 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[500px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-2xl mx-auto relative z-10">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6 tracking-tight leading-snug">Book a Demo</h2>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
            Tell us a bit about your setup and we&apos;ll show you exactly how much time you could save.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="bg-[#050B1C]/80 border border-white/10 rounded-2xl p-5 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.3)] backdrop-blur-xl"
        >
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <SuccessPanel key="success" onReset={() => setIsSuccess(false)} />
            ) : (
              <ContactForm
                key="form"
                onSuccess={() => setIsSuccess(true)}
                isError={isError}
                setIsError={setIsError}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </Section>
  );
}
