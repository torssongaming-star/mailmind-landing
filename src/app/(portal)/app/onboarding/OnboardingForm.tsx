"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "workspace" | "website" | "manual";

type KnowledgeEntry = { question: string; answer: string; category: string };

// ── Step 1: Workspace name ─────────────────────────────────────────────────────

function WorkspaceStep({
  email,
  suggestedOrgName,
  onNext,
}: {
  email: string;
  suggestedOrgName: string;
  onNext: (orgName: string) => void;
}) {
  const [orgName, setOrgName] = useState(suggestedOrgName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/app/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: orgName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not create your account");
      }
      onNext(orgName.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Din e-post</label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full bg-white/5 text-muted-foreground text-sm rounded-lg px-4 py-2.5 border border-white/8 cursor-not-allowed"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Företagets namn</label>
        <input
          type="text"
          value={orgName}
          onChange={e => setOrgName(e.target.value)}
          placeholder="t.ex. Acme AB"
          required
          maxLength={120}
          className="w-full bg-white/5 text-white text-sm rounded-lg px-4 py-2.5 border border-white/10 focus:border-primary/50 focus:outline-none placeholder:text-muted-foreground/40"
        />
        <p className="text-[10px] text-muted-foreground mt-1">Visas i appen och på fakturor.</p>
      </div>
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}
      <button
        type="submit"
        disabled={submitting || !orgName.trim()}
        className="w-full px-4 py-2.5 rounded-xl bg-primary text-[#030614] text-sm font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40"
      >
        {submitting ? "Skapar ditt konto…" : "Fortsätt →"}
      </button>
    </form>
  );
}

// ── Step 2: Website scrape ─────────────────────────────────────────────────────

/** Cleans common copy-paste mistakes — accepts "energikompaniet.se", "https://energikompaniet.se/", " www.foo.se". */
function cleanDomain(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

function isValidDomain(input: string): boolean {
  const c = cleanDomain(input);
  return /^[a-z0-9][\w.-]*\.[a-z]{2,}(\/.*)?$/i.test(c);
}

function WebsiteStep({
  onScraped,
  onSkip,
}: {
  onScraped: (entries: KnowledgeEntry[]) => void;
  onSkip: () => void;
}) {
  const [domain, setDomain]     = useState("");
  const [scraping, setScraping] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  const valid = domain.trim().length === 0 || isValidDomain(domain);

  const scrape = async () => {
    if (!domain.trim() || scraping || !isValidDomain(domain)) return;
    setScraping(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/app/knowledge/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cleanDomain(domain) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Scrape failed");
      if (data.inserted > 0) {
        setSuccess(`✓ Hittade ${data.inserted} svar från din hemsida.`);
        onScraped(data.entries ?? []);
      } else {
        setSuccess("Hittade ingen tydlig info på sidan. Du kan lägga till svar manuellt i nästa steg.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte läsa hemsidan");
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Har du en hemsida?</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Vi läser av din hemsida och fyller automatiskt i vanliga frågor &amp; priser åt dig.
          Hoppa över om du inte har någon hemsida — du kan alltid lägga till svar senare.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Din hemsidas adress
        </label>
        <div className="flex items-center gap-0">
          <span className="text-xs text-muted-foreground/60 px-3 py-2.5 bg-white/5 border border-r-0 border-white/10 rounded-l-lg select-none">
            https://
          </span>
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            value={domain}
            onChange={e => setDomain(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); scrape(); } }}
            placeholder="energikompaniet.se"
            className="flex-1 bg-white/5 text-white text-sm rounded-r-lg px-3 py-2.5 border border-white/10 focus:border-primary/50 focus:outline-none placeholder:text-muted-foreground/40"
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Skriv bara <span className="text-white/80 font-mono">energikompaniet.se</span> — du behöver inte skriva <span className="font-mono">https://</span> själv.
        </p>
        {!valid && domain.trim().length > 0 && (
          <p className="text-[11px] text-amber-400 mt-1">
            Det ser inte ut som en webbadress — försök t.ex. <span className="font-mono">energikompaniet.se</span>.
          </p>
        )}
      </div>

      {success && <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{success}</p>}
      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex justify-between items-center pt-2 border-t border-white/8">
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground hover:text-white transition-colors"
        >
          Hoppa över →
        </button>
        <div className="flex gap-2">
          {success ? (
            <button
              onClick={onSkip}
              className="px-4 py-2.5 rounded-xl bg-primary text-[#030614] text-sm font-semibold hover:bg-cyan-300 transition-colors"
            >
              Fortsätt →
            </button>
          ) : (
            <button
              onClick={scrape}
              disabled={scraping || !domain.trim() || !valid}
              className="px-4 py-2.5 rounded-xl bg-primary text-[#030614] text-sm font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40"
            >
              {scraping ? "Läser hemsidan…" : "Hämta info"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Manual FAQ entries ─────────────────────────────────────────────────

function ManualStep({
  entries,
  onAddEntry,
  onFinish,
}: {
  entries: KnowledgeEntry[];
  onAddEntry: (e: KnowledgeEntry) => void;
  onFinish: () => void;
}) {
  const [newQ, setNewQ]     = useState("");
  const [newA, setNewA]     = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const add = async () => {
    if (!newQ.trim() || !newA.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/app/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: newQ.trim(), answer: newA.trim(), category: "faq" }),
      });
      if (!res.ok) throw new Error("Kunde inte spara");
      onAddEntry({ question: newQ.trim(), answer: newA.trim(), category: "faq" });
      setNewQ("");
      setNewA("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte spara");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Lägg till vanliga svar</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          AI:n använder dessa när den föreslår svar till dina kunder.
          {entries.length === 0 && " Lägg till några om du vill — eller hoppa över."}
        </p>
      </div>

      {/* Existing entries (from scrape or this step) */}
      {entries.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-1.5 max-h-44 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {entries.length} svar sparade
          </p>
          {entries.map((e, i) => (
            <div key={i} className="text-xs">
              <span className="text-white/80 font-medium">{e.question}</span>
              <span className="text-muted-foreground"> — {e.answer.slice(0, 80)}{e.answer.length > 80 ? "…" : ""}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <input
          type="text"
          value={newQ}
          onChange={e => setNewQ(e.target.value)}
          placeholder="Fråga, t.ex. Vad kostar parkering?"
          className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2.5 border border-white/10 focus:border-primary/50 focus:outline-none placeholder:text-muted-foreground/40"
        />
        <textarea
          value={newA}
          onChange={e => setNewA(e.target.value)}
          placeholder="Svar, t.ex. Parkering kostar 500 kr/mån. Kontakta receptionen."
          rows={2}
          className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2.5 border border-white/10 focus:border-primary/50 focus:outline-none placeholder:text-muted-foreground/40 resize-none"
        />
        <button
          onClick={add}
          disabled={saving || !newQ.trim() || !newA.trim()}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/8 text-white hover:bg-white/15 transition-colors disabled:opacity-40"
        >
          {saving ? "Sparar…" : "+ Lägg till svar"}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-white/8">
        <button
          onClick={onFinish}
          className="text-xs text-muted-foreground hover:text-white transition-colors"
        >
          Hoppa över →
        </button>
        <button
          onClick={onFinish}
          className="px-4 py-2.5 rounded-xl bg-primary text-[#030614] text-sm font-semibold hover:bg-cyan-300 transition-colors"
        >
          {entries.length > 0 ? "Klart, gå till appen →" : "Fortsätt utan svar →"}
        </button>
      </div>
    </div>
  );
}

// ── Stepper shell ──────────────────────────────────────────────────────────────

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "workspace", label: "Konto" },
  { id: "website",   label: "Hemsida" },
  { id: "manual",    label: "Svar" },
];

export function OnboardingForm({
  email,
  suggestedOrgName,
}: {
  email: string;
  suggestedOrgName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("workspace");
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);

  const currentIdx = STEPS.findIndex(s => s.id === step);

  const finish = () => {
    router.push("/app");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
              i < currentIdx
                ? "bg-primary text-[#030614]"
                : i === currentIdx
                  ? "bg-primary/20 text-primary border border-primary/50"
                  : "bg-white/8 text-muted-foreground"
            }`}>
              {i < currentIdx ? "✓" : i + 1}
            </div>
            <span className={`text-[11px] transition-colors ${i === currentIdx ? "text-white" : "text-muted-foreground"}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px ${i < currentIdx ? "bg-primary/40" : "bg-white/10"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === "workspace" && (
        <WorkspaceStep
          email={email}
          suggestedOrgName={suggestedOrgName}
          onNext={() => setStep("website")}
        />
      )}
      {step === "website" && (
        <WebsiteStep
          onScraped={list => { setEntries(prev => [...prev, ...list]); setStep("manual"); }}
          onSkip={() => setStep("manual")}
        />
      )}
      {step === "manual" && (
        <ManualStep
          entries={entries}
          onAddEntry={e => setEntries(prev => [...prev, e])}
          onFinish={finish}
        />
      )}
    </div>
  );
}
