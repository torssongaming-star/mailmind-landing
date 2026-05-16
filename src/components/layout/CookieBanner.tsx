"use client";

/**
 * Cookie consent banner — GDPR/ePrivacy-compliant.
 *
 * Stores choice in localStorage under `mailmind-consent` as JSON:
 *   { analytics: boolean, functional: boolean, ts: number, version: number }
 *
 * Version bump = re-prompt all users (use when adding new tracking).
 *
 * The banner does NOT block analytics by itself — consuming code must read
 * `getConsent()` before initialising tracking. This file exposes that helper.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";

const STORAGE_KEY = "mailmind-consent";
const CURRENT_VERSION = 1;

export type Consent = {
  analytics:  boolean;
  functional: boolean;
  ts:         number;
  version:    number;
};

/** Returns current consent or null if user hasn't decided yet */
export function getConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Consent;
    if (parsed.version !== CURRENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveConsent(c: Omit<Consent, "ts" | "version">) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...c,
    ts: Date.now(),
    version: CURRENT_VERSION,
  }));
  // Notify the rest of the app — e.g. so analytics can load if newly granted
  window.dispatchEvent(new CustomEvent("mailmind:consent-updated", { detail: c }));
}

export function CookieBanner() {
  const [show, setShow]         = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics]     = useState(false);
  const [functional, setFunctional]   = useState(true);

  useEffect(() => {
    const c = getConsent();
    if (!c) setShow(true);
  }, []);

  // Listen for external "open preferences" trigger (from footer link)
  useEffect(() => {
    const onOpen = () => setShow(true);
    window.addEventListener("mailmind:open-cookie-prefs", onOpen);
    return () => window.removeEventListener("mailmind:open-cookie-prefs", onOpen);
  }, []);

  if (!show) return null;

  const acceptAll = () => {
    saveConsent({ analytics: true, functional: true });
    setShow(false);
  };
  const rejectAll = () => {
    saveConsent({ analytics: false, functional: false });
    setShow(false);
  };
  const saveCustom = () => {
    saveConsent({ analytics, functional });
    setShow(false);
  };

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-auto md:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-200"
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-desc"
    >
      <div className="rounded-2xl border border-white/10 bg-[hsl(var(--surface-elev-1))]/95 backdrop-blur-md shadow-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Cookie size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="cookie-banner-title" className="text-sm font-semibold text-white">
              Vi värnar om din integritet
            </h2>
            <p id="cookie-banner-desc" className="text-xs text-white/55 leading-relaxed mt-1">
              Vi använder cookies för att tjänsten ska fungera, komma ihåg dina inställningar
              och förstå hur den används. Du bestämmer.{" "}
              <Link href="/cookies" className="text-primary hover:underline">Läs mer</Link>
            </p>
          </div>
        </div>

        {showDetails && (
          <div className="mt-4 space-y-3 pt-4 border-t border-white/8">
            <Option
              label="Strikt nödvändiga"
              hint="Krävs för inloggning och säkerhet. Kan inte stängas av."
              checked={true}
              disabled
              onChange={() => {}}
            />
            <Option
              label="Funktionella"
              hint="Sparar dina val, t.ex. språk."
              checked={functional}
              onChange={setFunctional}
            />
            <Option
              label="Analys"
              hint="Anonym sidstatistik som hjälper oss förbättra tjänsten."
              checked={analytics}
              onChange={setAnalytics}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {!showDetails ? (
            <>
              <button
                onClick={acceptAll}
                className="flex-1 h-9 px-4 rounded-lg bg-primary text-[hsl(var(--surface-base))] text-xs font-semibold hover:bg-cyan-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                Acceptera alla
              </button>
              <button
                onClick={rejectAll}
                className="flex-1 h-9 px-4 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                Avvisa alla
              </button>
              <button
                onClick={() => setShowDetails(true)}
                className="h-9 px-3 rounded-lg text-xs text-white/60 hover:text-white transition-colors focus-visible:outline-none focus-visible:underline"
              >
                Anpassa
              </button>
            </>
          ) : (
            <>
              <button
                onClick={saveCustom}
                className="flex-1 h-9 px-4 rounded-lg bg-primary text-[hsl(var(--surface-base))] text-xs font-semibold hover:bg-cyan-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                Spara val
              </button>
              <button
                onClick={() => setShowDetails(false)}
                aria-label="Stäng detaljer"
                className="h-9 w-9 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                <X size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Option({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint:  string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`flex items-start gap-3 p-2 -mx-2 rounded-lg ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-white/[0.02]"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 shrink-0 cursor-pointer disabled:cursor-not-allowed"
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white">{label}</p>
        <p className="text-[11px] text-white/45 leading-relaxed mt-0.5">{hint}</p>
      </div>
    </label>
  );
}

/** Dispatch this event from a footer link to re-open the banner */
export function openCookiePreferences() {
  window.dispatchEvent(new CustomEvent("mailmind:open-cookie-prefs"));
}
