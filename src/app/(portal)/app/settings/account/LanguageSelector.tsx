"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";

export function LanguageSelector() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [currentLocale, setCurrentLocale] = useState(locale);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (newLocale: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/app/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: newLocale }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save language");
      }

      setCurrentLocale(newLocale as any);
      setSavedAt(new Date());
      
      // Refresh to apply changes and update RootLayout/middleware
      router.refresh();
      
      // Force a small delay to show success before potential re-render finish
      setTimeout(() => setSavedAt(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-white">{t("settings.common.language")}</h3>
        <p className="text-xs text-slate-400">{t("settings.common.selectLanguage")}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => handleSave("sv")}
          disabled={saving}
          className={`flex-1 flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
            currentLocale === "sv"
              ? "bg-primary/10 border-primary text-primary"
              : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
          }`}
        >
          <span className="text-sm font-medium">{t("settings.common.swedish")}</span>
          {currentLocale === "sv" && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
        </button>

        <button
          onClick={() => handleSave("en")}
          disabled={saving}
          className={`flex-1 flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
            currentLocale === "en"
              ? "bg-primary/10 border-primary text-primary"
              : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
          }`}
        >
          <span className="text-sm font-medium">{t("settings.common.english")}</span>
          {currentLocale === "en" && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
        </button>
      </div>

      <div className="min-h-[1.25rem] flex items-center justify-center">
        {saving && <span className="text-[10px] text-slate-500 uppercase tracking-widest animate-pulse">{t("settings.common.saving")}</span>}
        {error && <span className="text-[10px] text-red-400 uppercase tracking-widest">{error}</span>}
        {!error && savedAt && <span className="text-[10px] text-green-400 uppercase tracking-widest font-bold">{t("settings.common.saveSuccess")}</span>}
      </div>
    </div>
  );
}
