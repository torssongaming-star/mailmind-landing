"use client";

/**
 * LOI-formuläret. Live-uppdaterar intent-textens preview när användaren
 * skriver namn + företag — den exakta text som visas är vad som skickas
 * till servern och lagras ordagrant.
 *
 * Klick på "Skriv på" → POST /api/loi → success-state med tack-meddelande.
 */

import { useState, useMemo } from "react";
import { generateIntentText } from "@/lib/loi/intent-text";

type CompanySize = "1-10" | "11-50" | "51-200" | "201-500" | "500+";

export function LoiForm() {
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [company, setCompany]     = useState("");
  const [role, setRole]           = useState("");
  const [companySize, setCompanySize] = useState<CompanySize | "">("");
  const [phone, setPhone]         = useState("");
  const [accepted, setAccepted]   = useState(false);
  const [honeypot, setHoneypot]   = useState(""); // bot-fångare, dold

  const [pending, setPending] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [done, setDone]       = useState(false);

  const intentText = useMemo(
    () => generateIntentText({ name, company }),
    [name, company],
  );

  const canSubmit =
       name.trim().length    >= 2
    && email.trim().length   >= 5
    && /@/.test(email)
    && company.trim().length >= 2
    && accepted
    && !pending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/loi", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, company,
          role:        role        || null,
          companySize: companySize || null,
          phone:       phone       || null,
          website:     honeypot,
          acceptedAt:  new Date().toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Något gick fel");
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-green-500/30 bg-green-500/[0.05] p-6 md:p-8 text-center space-y-3 shadow-[0_2px_24px_-12px_rgba(34,197,94,0.35)]">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-green-500/15 border border-green-500/30 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400" aria-hidden>
            <path d="M5 12l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Tack — vi har tagit emot din avsiktsförklaring</h2>
        <p className="text-sm text-white/70 leading-relaxed max-w-md mx-auto">
          Vi har skickat en bekräftelse till <strong className="text-white">{email}</strong>.
          Klicka på länken i mejlet för att verifiera mejladressen.
          Hör inte av sig nu — vi kontaktar dig inför lansering.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Namn" required>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            minLength={2}
            maxLength={255}
            autoComplete="name"
            className="loi-input"
          />
        </Field>
        <Field label="E-post" required>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            maxLength={320}
            autoComplete="email"
            className="loi-input"
          />
        </Field>
        <Field label="Företag" required>
          <input
            type="text"
            value={company}
            onChange={e => setCompany(e.target.value)}
            required
            minLength={2}
            maxLength={255}
            autoComplete="organization"
            className="loi-input"
          />
        </Field>
        <Field label="Din roll" hint="Frivilligt — hjälper oss vid uppföljning">
          <input
            type="text"
            value={role}
            onChange={e => setRole(e.target.value)}
            maxLength={100}
            autoComplete="organization-title"
            placeholder="t.ex. VD, kundansvarig"
            className="loi-input"
          />
        </Field>
        <Field label="Företagsstorlek" hint="Frivilligt">
          <select
            value={companySize}
            onChange={e => setCompanySize(e.target.value as CompanySize | "")}
            className="loi-input"
          >
            <option value="">Välj…</option>
            <option value="1-10">1–10 anställda</option>
            <option value="11-50">11–50 anställda</option>
            <option value="51-200">51–200 anställda</option>
            <option value="201-500">201–500 anställda</option>
            <option value="500+">500+ anställda</option>
          </select>
        </Field>
        <Field label="Telefon" hint="Frivilligt">
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            maxLength={64}
            autoComplete="tel"
            className="loi-input"
          />
        </Field>
      </div>

      {/* Honeypot — visuellt dold, fångar bots som fyller i alla fält */}
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={e => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
        aria-hidden
      />

      {/* Intent-text-preview — det som faktiskt lagras */}
      <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 space-y-2 shadow-[0_2px_24px_-12px_hsl(189_94%_43%/0.3)]">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-primary">
          Detta är texten du skriver på
        </p>
        <p className="text-sm text-white/85 whitespace-pre-line leading-relaxed">
          {intentText}
        </p>
      </div>

      {/* Checkbox-godkännande */}
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={accepted}
          onChange={e => setAccepted(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded accent-primary cursor-pointer shrink-0"
        />
        <span className="text-sm text-white/80 leading-relaxed">
          Jag bekräftar att ovanstående text är en avsiktsförklaring och inte
          ett juridiskt bindande avtal. Jag samtycker till att Mailmind sparar
          mina uppgifter för att kontakta mig inför lansering.
        </span>
      </label>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.05] px-4 py-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-xs text-white/55">
          Genom att skriva på lagras din IP-adress och tidsstämpel som signaturbevis.
        </p>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-primary text-[hsl(var(--surface-base))] text-sm font-semibold hover:bg-cyan-300 transition-all shadow-[0_4px_24px_-2px_hsl(189_94%_43%/0.45)] hover:shadow-[0_6px_32px_-2px_hsl(189_94%_43%/0.6)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "Skriver på…" : "Skriv på avsiktsförklaringen"}
        </button>
      </div>

      <style>{`
        .loi-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          color: white;
          font-size: 14px;
          border-radius: 10px;
          padding: 10px 14px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          outline: none;
          color-scheme: dark;
          transition: border-color 0.15s, background 0.15s;
        }
        .loi-input:hover {
          border-color: rgba(255, 255, 255, 0.2);
        }
        .loi-input:focus {
          border-color: hsl(189 94% 43% / 0.6);
          background: rgba(255, 255, 255, 0.06);
        }
        .loi-input option {
          background: #0a0f1e;
          color: white;
        }
      `}</style>
    </form>
  );
}

// ── Field-wrapper ─────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  required,
  children,
}: {
  label:     string;
  hint?:     string;
  required?: boolean;
  children:  React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium text-white/75">
        {label}
        {required && <span className="text-primary ml-1">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-white/50 leading-relaxed">{hint}</span>}
    </label>
  );
}
