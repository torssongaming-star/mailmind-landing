"use client";

import { useState, useEffect, useRef } from "react";
import { X, ChevronDown, HelpCircle, MessageSquare, ExternalLink, Check, Loader2 } from "lucide-react";

import { useI18n } from "@/lib/i18n/context";

// ── Component ─────────────────────────────────────────────────────────────────

export function SupportDrawer({
  open,
  onClose,
}: {
  open:    boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [tab, setTab]           = useState<"faq" | "contact">("faq");
  const [openFaq, setOpenFaq]   = useState<number | null>(null);
  const [subject, setSubject]   = useState("");
  const [message, setMessage]   = useState("");
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const drawerRef               = useRef<HTMLDivElement>(null);

  const FAQ_RAW = getRaw("settings.support.faqs");
  const FAQ = Array.isArray(FAQ_RAW) ? FAQ_RAW : [];

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Trap focus and reset state when opening
  useEffect(() => {
    if (open) { setSent(false); setError(null); }
  }, [open]);

  const send = async () => {
    if (!subject.trim() || !message.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res  = await fetch("/api/app/support", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("settings.common.error"));
      setSent(true);
      setSubject("");
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.common.error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={[
          "fixed top-0 right-0 z-50 h-full w-full max-w-md flex flex-col",
          "bg-[#050B1C] border-l border-white/8 shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-white">{t("settings.support.title")}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-white/8 px-6">
          {(["faq", "contact"] as const).map(tabName => (
            <button
              key={tabName}
              onClick={() => setTab(tabName)}
              className={[
                "px-1 py-3 text-xs font-semibold mr-6 border-b-2 -mb-px transition-colors",
                tab === tabName
                  ? "text-white border-primary"
                  : "text-white/35 border-transparent hover:text-white/60",
              ].join(" ")}
            >
              {tabName === "faq" ? t("settings.support.faq") : t("settings.support.contact")}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── FAQ ───────────────────────────────────────────────────── */}
          {tab === "faq" && (
            <div className="divide-y divide-white/5">
              {FAQ.map((item, i) => (
                <div key={i} className="px-6">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-3 py-4 text-left group"
                  >
                    <span className={`text-sm font-medium transition-colors ${openFaq === i ? "text-white" : "text-white/70 group-hover:text-white"}`}>
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 text-white/30 transition-transform duration-200 ${openFaq === i ? "rotate-180 text-primary" : ""}`}
                    />
                  </button>
                  {openFaq === i && (
                    <p className="text-sm text-white/50 leading-relaxed pb-4 -mt-1">
                      {item.a}
                    </p>
                  )}
                </div>
              ))}

              {/* Docs link */}
              <div className="px-6 py-5">
                <a
                  href="https://mailmind.se/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-white/35 hover:text-primary transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {t("settings.support.docs")}
                </a>
              </div>
            </div>
          )}

          {/* ── Contact ───────────────────────────────────────────────── */}
          {tab === "contact" && (
            <div className="px-6 py-6 space-y-5">
              {sent ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-green-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">{t("settings.support.sent")}</p>
                  <p className="text-xs text-white/40 max-w-xs">
                    {t("settings.support.sentDesc")}
                  </p>
                  <button
                    onClick={() => setSent(false)}
                    className="mt-2 text-xs text-primary hover:text-white transition-colors"
                  >
                    {t("settings.support.sendNew")}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
                    <MessageSquare className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-white/50 leading-relaxed">
                      {t("settings.support.contactNudge")}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                      {t("settings.support.subject")}
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder={t("settings.support.subjectPlaceholder")}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-primary/40 focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                      {t("settings.support.message")}
                    </label>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder={t("settings.support.messagePlaceholder")}
                      rows={6}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-primary/40 focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-red-400 px-1">{error}</p>
                  )}

                  <button
                    onClick={send}
                    disabled={sending || !subject.trim() || !message.trim()}
                    className="w-full py-2.5 rounded-xl bg-primary text-[#030614] text-sm font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {sending ? t("settings.support.sending") : t("settings.support.sendMessage")}
                  </button>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
