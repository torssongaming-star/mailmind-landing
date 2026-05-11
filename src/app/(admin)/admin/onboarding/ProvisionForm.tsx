"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { provisionCustomerAction } from "@/lib/admin/actions";
import { PLAN_LIST, PlanKey } from "@/lib/plans";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  { id: "standard_smb", label: "Standard SMB", description: "5 case types: general, order, complaint, billing, technical" },
  { id: "ecommerce",    label: "E-handel",     description: "5 case types: general, order, return, product, complaint" },
  { id: "empty",        label: "Tom",          description: "Inga fördefinierade case types — konfigurera manuellt" },
] as const;

type TemplateId = typeof TEMPLATES[number]["id"];

export function ProvisionForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [orgName,           setOrgName]           = useState("");
  const [ownerEmail,        setOwnerEmail]        = useState("");
  const [ownerClerkUserId,  setOwnerClerkUserId]  = useState("");
  const [plan,              setPlan]              = useState<PlanKey>("starter");
  const [trialDays,         setTrialDays]         = useState(14);
  const [template,          setTemplate]          = useState<TemplateId>("standard_smb");
  const [aiLanguage,        setAiLanguage]        = useState("sv");
  const [aiTone,            setAiTone]            = useState<"formal" | "friendly" | "neutral">("friendly");
  const [notes,             setNotes]             = useState("");
  const [result,            setResult]            = useState<{ success: true; orgId: string } | { success: false; error: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    startTransition(async () => {
      const res = await provisionCustomerAction({
        orgName:          orgName.trim(),
        ownerEmail:       ownerEmail.trim(),
        ownerClerkUserId: ownerClerkUserId.trim(),
        plan,
        trialDays,
        caseTypeTemplate: template,
        aiLanguage,
        aiTone,
        notes,
      });

      // Cast to discriminated union — TS can't narrow the server action return type automatically
      const typed = res as { success: true; orgId: string } | { success: false; error: string };
      setResult(typed);
      if (typed.success) {
        // Redirect to the new org detail page after a short delay
        setTimeout(() => router.push(`/admin/organizations/${typed.orgId}`), 1500);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
      {/* Result banner */}
      {result && (
        <div className={cn(
          "flex items-start gap-3 p-4 rounded-xl border text-sm",
          result.success
            ? "bg-green-500/10 border-green-500/30 text-green-200"
            : "bg-red-500/10 border-red-500/30 text-red-200"
        )}>
          {result.success
            ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-400 shrink-0" />
            : <AlertCircle  className="w-4 h-4 mt-0.5 text-red-400 shrink-0" />
          }
          <span>
            {result.success
              ? `Kund skapad! Org-ID: ${result.orgId} — Omdirigerar till detaljsidan…`
              : `Fel: ${result.error}`
            }
          </span>
        </div>
      )}

      {/* Section: Organisation */}
      <Section title="Organisation">
        <Field label="Organisationsnamn" required>
          <Input
            value={orgName}
            onChange={setOrgName}
            placeholder="Acme AB"
            required
          />
        </Field>
      </Section>

      {/* Section: Ägare */}
      <Section title="Ägare (Clerk-användare)">
        <p className="text-slate-500 text-xs mb-4">
          Clerk-användaren måste redan finnas — de ska ha registrerat sig på{" "}
          <code className="text-primary">/signup</code> innan du provisionerar.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="E-postadress" required>
            <Input
              type="email"
              value={ownerEmail}
              onChange={setOwnerEmail}
              placeholder="kund@foretag.se"
              required
            />
          </Field>
          <Field label="Clerk User ID" required>
            <Input
              value={ownerClerkUserId}
              onChange={setOwnerClerkUserId}
              placeholder="user_2abc..."
              required
            />
          </Field>
        </div>
        <p className="text-slate-600 text-[10px] mt-2">
          Clerk User ID finns i Clerk Dashboard → Users → klicka på användaren.
        </p>
      </Section>

      {/* Section: Plan & trial */}
      <Section title="Plan & trial">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {PLAN_LIST.filter(p => p.id !== "enterprise").map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlan(p.id as PlanKey)}
              className={cn(
                "p-3 rounded-xl border text-left transition-all",
                plan === p.id
                  ? "border-primary/50 bg-primary/10 text-white"
                  : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-white"
              )}
            >
              <div className="text-xs font-bold uppercase tracking-widest mb-1">{p.name}</div>
              <div className="text-[10px] text-slate-500">{p.price}/mån</div>
              <div className="text-[10px] text-slate-600 mt-1">
                {p.seatLimit} users · {p.inboxLimit} inbox · {p.draftsLimit.toLocaleString()} drafts
              </div>
            </button>
          ))}
        </div>

        <Field label={`Trial-längd (${trialDays} dagar)`}>
          <input
            type="range"
            min={7}
            max={60}
            step={7}
            value={trialDays}
            onChange={(e) => setTrialDays(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>7 dagar</span><span>30 dagar</span><span>60 dagar</span>
          </div>
        </Field>
      </Section>

      {/* Section: Case types */}
      <Section title="Case type-mall">
        <div className="space-y-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplate(t.id)}
              className={cn(
                "w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all",
                template === t.id
                  ? "border-primary/50 bg-primary/10"
                  : "border-white/10 bg-white/[0.02] hover:border-white/20"
              )}
            >
              <div className={cn(
                "w-3.5 h-3.5 rounded-full border-2 mt-0.5 shrink-0",
                template === t.id ? "border-primary bg-primary" : "border-slate-600"
              )} />
              <div>
                <div className="text-white text-xs font-bold">{t.label}</div>
                <div className="text-slate-500 text-[10px] mt-0.5">{t.description}</div>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* Section: AI */}
      <Section title="AI-inställningar">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Språk">
            <select
              value={aiLanguage}
              onChange={(e) => setAiLanguage(e.target.value)}
              className="w-full bg-[#030614] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-primary/50 outline-none"
            >
              <option value="sv">Svenska (sv)</option>
              <option value="en">English (en)</option>
              <option value="no">Norsk (no)</option>
              <option value="da">Dansk (da)</option>
            </select>
          </Field>
          <Field label="Ton">
            <select
              value={aiTone}
              onChange={(e) => setAiTone(e.target.value as "formal" | "friendly" | "neutral")}
              className="w-full bg-[#030614] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-primary/50 outline-none"
            >
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
              <option value="neutral">Neutral</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* Section: Anteckning */}
      <Section title="Intern anteckning (valfri)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="T.ex. 'Onboarding-samtal 12 maj, demo på måndag. Kontakt: Maja Svensson'"
          rows={3}
          className="w-full bg-[#030614] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-primary/50 outline-none resize-none"
        />
      </Section>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending || !orgName.trim() || !ownerEmail.trim() || !ownerClerkUserId.trim()}
        className="flex items-center gap-2 px-6 py-3 bg-primary text-black font-bold rounded-xl hover:bg-cyan-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Provisionerar…</>
        ) : (
          <>Provision kund <ChevronRight className="w-4 h-4" /></>
        )}
      </button>
    </form>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-6 space-y-4">
      <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-white/5 pb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-slate-300 text-xs font-medium">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ type = "text", value, onChange, placeholder, required }: {
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full bg-[#030614] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-primary/50 outline-none transition-colors"
    />
  );
}
