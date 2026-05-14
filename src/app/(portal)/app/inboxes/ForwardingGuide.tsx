"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";

type Client = "outlook-web" | "outlook-app" | "gmail" | "apple-mail";

export function ForwardingGuide({ mailmindAddress }: { mailmindAddress: string }) {
  const { t } = useI18n();
  const [open, setOpen]     = useState(false);
  const [client, setClient] = useState<Client>("outlook-web");
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(mailmindAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const CLIENTS: { id: Client; label: string }[] = [
    { id: "outlook-web",  label: t("inboxes.guide.clients.outlookWeb.label") },
    { id: "outlook-app",  label: t("inboxes.guide.clients.outlookApp.label") },
    { id: "gmail",        label: t("inboxes.guide.clients.gmail.label") },
    { id: "apple-mail",   label: t("inboxes.guide.clients.appleMail.label") },
  ];

  const getGuide = (c: Client) => {
    switch (c) {
      case "outlook-web": return { title: t("inboxes.guide.clients.outlookWeb.title"), steps: t("inboxes.guide.clients.outlookWeb.steps" as any) as unknown as string[] };
      case "outlook-app": return { title: t("inboxes.guide.clients.outlookApp.title"), steps: t("inboxes.guide.clients.outlookApp.steps" as any) as unknown as string[] };
      case "gmail":       return { title: t("inboxes.guide.clients.gmail.title"),      steps: t("inboxes.guide.clients.gmail.steps" as any) as unknown as string[] };
      case "apple-mail":  return { title: t("inboxes.guide.clients.appleMail.title"),  steps: t("inboxes.guide.clients.appleMail.steps" as any) as unknown as string[] };
    }
  };

  const guide = getGuide(client);

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.03] overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-base">📬</span>
          <div>
            <p className="text-sm font-semibold text-white">{t("inboxes.guide.title")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("inboxes.guide.description")}
            </p>
          </div>
        </div>
        <span className="text-muted-foreground text-sm transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "none" }}>
          ▾
        </span>
      </button>

      {open && (
        <div className="border-t border-cyan-500/10 px-5 pb-5 space-y-4">

          {/* Address copy box */}
          <div className="rounded-lg bg-black/30 px-3 py-2.5 flex items-center justify-between gap-3 mt-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                {t("inboxes.guide.yourAddress")}
              </p>
              <p className="text-sm font-mono text-cyan-300 truncate">{mailmindAddress}</p>
            </div>
            <button
              onClick={copy}
              className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white transition-colors shrink-0"
            >
              {copied ? t("inboxes.editor.copied") : t("inboxes.editor.copy")}
            </button>
          </div>

          {/* Client tabs */}
          <div className="flex flex-wrap gap-1.5">
            {CLIENTS.map(c => (
              <button
                key={c.id}
                onClick={() => setClient(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  client === c.id
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : "bg-white/5 text-muted-foreground border border-white/10 hover:text-white hover:border-white/20"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Steps */}
          <div>
            <p className="text-xs font-semibold text-white/80 mb-3">{guide.title}</p>
            <ol className="space-y-2.5">
              {guide.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-white/80 leading-relaxed">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Video placeholder */}
          <div className="rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3 flex items-center gap-3">
            <span className="text-xl">▶️</span>
            <div>
              <p className="text-xs font-semibold text-white/70">{t("inboxes.guide.videoComingSoon")}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t("inboxes.guide.videoComingSoonDesc")}
              </p>
            </div>
          </div>

          {/* Help link */}
          <p className="text-[10px] text-muted-foreground">
            {t("inboxes.guide.helpLink")}{" "}
            <a href="mailto:support@mailmind.se" className="text-cyan-400 hover:underline">
              {t("inboxes.guide.contactSupport")}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
