"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Send, CheckCircle2, AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm md:text-base placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all";

const selectClass =
  "w-full bg-[#050B1C] border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all appearance-none";

const labelClass = "block text-xs md:text-sm font-medium text-white/80 mb-1.5";

function SuccessPanel({ onReset }: { onReset: () => void }) {
  const { t } = useI18n();
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
        <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{t("landing.contact.successTitle")}</h3>
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-sm">
          {t("landing.contact.successDesc")}
        </p>
      </div>
      <button
        onClick={onReset}
        className="text-xs text-muted-foreground hover:text-white underline underline-offset-2 transition-colors mt-2"
      >
        {t("landing.contact.reset")}
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
  const { t } = useI18n();

  const volumes = [
    { value: "<100", label: t("landing.contact.vol1") },
    { value: "100-500", label: t("landing.contact.vol2") },
    { value: "500-2000", label: t("landing.contact.vol3") },
    { value: "2000+", label: t("landing.contact.vol4") },
  ];

  const systems = [
    { value: "outlook", label: t("landing.contact.sys1") },
    { value: "gmail", label: t("landing.contact.sys2") },
    { value: "imap", label: t("landing.contact.sys3") },
    { value: "other", label: t("landing.contact.sys4") },
  ];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setIsError(false);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to send request");
      }

      onSuccess();
    } catch (err) {
      console.error("[ContactForm] Submission error:", err);
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
      {/* Honeypot field — hidden from users */}
      <input type="text" name="websiteUrl" className="hidden" aria-hidden="true" tabIndex={-1} />

      {/* Row 1: Name + Email */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label htmlFor="fullName" className={labelClass}>{t("landing.contact.fullName")}</label>
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
          <label htmlFor="workEmail" className={labelClass}>{t("landing.contact.workEmail")}</label>
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
          <label htmlFor="companyName" className={labelClass}>{t("landing.contact.companyName")}</label>
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
            {t("landing.contact.website")} <span className="text-white/50 font-normal">({t("landing.contact.optional")})</span>
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
        <label htmlFor="emailVolume" className={labelClass}>{t("landing.contact.emailVolume")}</label>
        <div className="relative">
          <select id="emailVolume" name="emailVolume" className={selectClass}>
            {volumes.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
        </div>
      </div>

      {/* Current system */}
      <div>
        <label htmlFor="currentSystem" className={labelClass}>{t("landing.contact.currentSystem")}</label>
        <div className="relative">
          <select id="currentSystem" name="currentSystem" className={selectClass}>
            {systems.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
        </div>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="message" className={labelClass}>
          {t("landing.contact.message")} <span className="text-white/50 font-normal">({t("landing.contact.optional")})</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          className={`${inputClass} resize-none custom-scrollbar`}
          placeholder={t("landing.contact.messagePlaceholder")}
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
            <span>{t("landing.contact.error")}</span>
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
            {t("landing.contact.sending")}
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            {t("landing.contact.submit")}
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground pt-1">
        {t("landing.contact.nudge")}
      </p>
    </motion.form>
  );
}

export function Contact() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const { t } = useI18n();

  return (
    <Section id="contact" className="border-b border-white/5 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[500px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-2xl mx-auto relative z-10">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-6 tracking-tight leading-snug">{t("landing.contact.title")}</h2>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
            {t("landing.contact.description")}
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

