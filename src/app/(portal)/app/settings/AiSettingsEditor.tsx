"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AiSettingsEditor({
  initial,
}: {
  initial: {
    tone:            "formal" | "friendly" | "neutral";
    language:        string;
    maxInteractions: number;
    signature:       string | null;
  };
}) {
  const router = useRouter();
  const [tone, setTone]                       = useState(initial.tone);
  const [language, setLanguage]               = useState(initial.language);
  const [maxInteractions, setMaxInteractions] = useState(initial.maxInteractions);
  const [signature, setSignature]             = useState(initial.signature ?? "");
  const [saving, setSaving]   = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/app/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone, language, maxInteractions, signature: signature.trim() || null }),
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
    <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5 space-y-4">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Tone">
          <select value={tone} onChange={e => setTone(e.target.value as typeof tone)} className="select-style">
            <option value="friendly">Friendly</option>
            <option value="formal">Formal</option>
            <option value="neutral">Neutral</option>
          </select>
        </Field>

        <Field label="Language">
          <select value={language} onChange={e => setLanguage(e.target.value)} className="select-style">
            <option value="sv">Svenska</option>
            <option value="en">English</option>
            <option value="no">Norsk</option>
            <option value="da">Dansk</option>
            <option value="fi">Suomi</option>
          </select>
        </Field>

        <Field label="Max follow-up questions">
          <select
            value={maxInteractions}
            onChange={e => setMaxInteractions(Number(e.target.value))}
            className="select-style"
          >
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>{n} {n === 1 ? "question" : "questions"}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Email signature (appended to AI replies — optional)">
        <textarea
          value={signature}
          onChange={e => setSignature(e.target.value)}
          rows={3}
          placeholder="Vänliga hälsningar,&#10;Mailmind-teamet"
          className="select-style resize-none"
        />
      </Field>

      <div className="flex items-center justify-between border-t border-white/5 pt-3">
        <div className="text-xs">
          {error && <span className="text-red-400">{error}</span>}
          {!error && savedAt && <span className="text-green-400">Saved {savedAt.toLocaleTimeString("sv-SE")}</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 rounded-lg bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
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
        }
        .select-style:focus {
          border-color: rgba(99, 102, 241, 0.5);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}
