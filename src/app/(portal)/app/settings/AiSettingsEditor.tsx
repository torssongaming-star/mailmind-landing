"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export function AiSettingsEditor({
  initial,
}: {
  initial: {
    tone:                 "formal" | "friendly" | "neutral";
    language:             string;
    maxInteractions:      number;
    signature:            string | null;
    bulkFilterEnabled:    boolean;
    bulkFilterWhitelist:  string[];
  };
}) {
  const router = useRouter();
  const [tone, setTone]                                 = useState(initial.tone);
  const [language, setLanguage]                         = useState(initial.language);
  const [maxInteractions, setMaxInteractions]           = useState(initial.maxInteractions);
  const [bulkFilterEnabled, setBulkFilterEnabled]       = useState(initial.bulkFilterEnabled);
  const [whitelistText, setWhitelistText]               = useState(initial.bulkFilterWhitelist.join("\n"));
  const [saving, setSaving]   = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const currentSignature = editorRef.current?.innerHTML ?? "";
      const whitelist = whitelistText
        .split(/[\n,]/)
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      const res = await fetch("/api/app/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone, language, maxInteractions,
          signature: currentSignature.trim() || null,
          bulkFilterEnabled,
          bulkFilterWhitelist: whitelist,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      setSavedAt(new Date());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-5 space-y-4">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Ton" hint="Hur AI:n låter i sina svar.">
          <select value={tone} onChange={e => setTone(e.target.value as typeof tone)} className="select-style">
            <option value="friendly">Vänlig</option>
            <option value="formal">Formell</option>
            <option value="neutral">Neutral</option>
          </select>
        </Field>

        <Field label="Språk" hint="Språk AI:n skriver svar på.">
          <select value={language} onChange={e => setLanguage(e.target.value)} className="select-style">
            <option value="sv">Svenska</option>
            <option value="en">English</option>
            <option value="no">Norsk</option>
            <option value="da">Dansk</option>
            <option value="fi">Suomi</option>
          </select>
        </Field>

        <Field
          label="Max uppföljningsfrågor"
          hint="Hur många gånger AI:n får fråga kunden om mer info innan den skickar ärendet vidare till er."
        >
          <select
            value={maxInteractions}
            onChange={e => setMaxInteractions(Number(e.target.value))}
            className="select-style"
          >
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>{n} {n === 1 ? "gång" : "gånger"}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="E-postsignatur (läggs till i AI:ns svar — valfritt, stödjer bilder och länkar)">
        <div
          ref={editorRef}
          contentEditable
          dangerouslySetInnerHTML={{ __html: initial.signature ?? "" }}
          className="select-style w-full min-h-[80px] overflow-auto"
        />
        <p className="text-[10px] text-muted-foreground/60 mt-1 leading-relaxed">
          Du kan kopiera och klistra in en befintlig e-postsignatur här för att behålla dess formatering.
        </p>
      </Field>

      {/* ── Bulk / marketing filter ──────────────────────────────────────────── */}
      <div className="border-t border-white/5 pt-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-white">Filtrera marknadsföringsmejl automatiskt</label>
            <p className="text-[10px] text-muted-foreground/70 mt-1 leading-relaxed">
              Mejl som innehåller bulk-signaler (nyhetsbrev, kampanjer, system­notiser m.m.) flyttas automatiskt
              till fliken &quot;Reklam&quot; och slipper AI-bearbetning. Du kan se vad som filtrerats och flytta tillbaka enskilda mejl manuellt.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBulkFilterEnabled(v => !v)}
            role="switch"
            aria-checked={bulkFilterEnabled}
            className={`shrink-0 relative w-10 h-6 rounded-full transition-colors ${
              bulkFilterEnabled ? "bg-primary" : "bg-white/15"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                bulkFilterEnabled ? "translate-x-4" : ""
              }`}
            />
          </button>
        </div>

        {bulkFilterEnabled && (
          <Field
            label="Whitelist — släpp alltid igenom dessa avsändare"
            hint="En per rad. Domän börjar med @ (t.ex. @vendor.se) eller fullständig e-postadress (t.ex. info@viktigkund.se)."
          >
            <textarea
              value={whitelistText}
              onChange={e => setWhitelistText(e.target.value)}
              placeholder="@viktigkund.se&#10;notiser@bank.se"
              rows={3}
              className="select-style w-full font-mono text-[12px]"
              style={{ resize: "vertical" }}
            />
          </Field>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/5 pt-3">
        <div className="text-xs">
          {error && <span className="text-red-400">{error}</span>}
          {!error && savedAt && <span className="text-green-400">Sparades {savedAt.toLocaleTimeString("sv-SE")}</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 rounded-lg bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40"
        >
          {saving ? "Sparar…" : "Spara"}
        </button>
      </div>

      <style>{`
        .select-style {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          color: white;
          font-size: 13px;
          border-radius: 8px;
          padding: 8px 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          outline: none;
          color-scheme: dark;
        }
        .select-style:focus {
          border-color: rgba(99, 102, 241, 0.5);
        }
        .select-style option {
          background: #0a0f1e;
          color: white;
        }
      `}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground/60 mt-1 leading-relaxed">{hint}</p>}
    </div>
  );
}
