"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────────

type Step = "workspace" | "website" | "casetypes" | "webhooks";

type KnowledgeEntry = { question: string; answer: string; category: string };

type CaseTypeOption = {
  slug:    string;
  label:   string;
  checked: boolean;
  custom?: boolean;
};

// ── Progress bar ───────────────────────────────────────────────────────────────

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "workspace", label: "Konto" },
  { id: "website",   label: "Hemsida" },
  { id: "casetypes", label: "Ärendetyper" },
  { id: "webhooks",  label: "Notifikationer" },
];

function ProgressBar({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.id === current);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2 flex-1">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
            i < idx
              ? "bg-primary text-[#030614]"
              : i === idx
                ? "bg-primary/20 text-primary border border-primary/50"
                : "bg-white/8 text-muted-foreground"
          }`}>
            {i < idx ? "✓" : i + 1}
          </div>
          <span className={`text-[11px] transition-colors ${i === idx ? "text-white" : "text-muted-foreground"}`}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-px ${i < idx ? "bg-primary/40" : "bg-white/10"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Workspace ──────────────────────────────────────────────────────────

function WorkspaceStep({
  email,
  suggestedOrgName,
  onNext,
}: {
  email: string;
  suggestedOrgName: string;
  onNext: () => void;
}) {
  const [orgName, setOrgName]   = useState(suggestedOrgName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/app/onboarding", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ orgName: orgName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Kunde inte skapa kontot");
      }
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Välkommen till Mailmind</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Låt oss sätta upp ert konto. Det tar ungefär två minuter.
        </p>
      </div>
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

function cleanDomain(input: string): string {
  return input.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
}

function isValidDomain(input: string): boolean {
  return /^[a-z0-9][\w.-]*\.[a-z]{2,}(\/.*)?$/i.test(cleanDomain(input));
}

function WebsiteStep({
  onNext,
}: {
  onNext: (entries: KnowledgeEntry[]) => void;
}) {
  const [domain, setDomain]       = useState("");
  const [noSite, setNoSite]       = useState(false);
  const [scraping, setScraping]   = useState(false);
  const [scraped, setScraped]     = useState<KnowledgeEntry[] | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const valid = domain.trim().length === 0 || isValidDomain(domain);

  const scrape = async () => {
    if (!domain.trim() || scraping || !isValidDomain(domain)) return;
    setScraping(true);
    setError(null);
    try {
      const res = await fetch("/api/app/knowledge/scrape", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: cleanDomain(domain) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Kunde inte läsa hemsidan");
      setScraped(data.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte läsa hemsidan");
    } finally {
      setScraping(false);
    }
  };

  if (noSite) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-white mb-1">Har ni en hemsida?</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Inga problem — ni kan alltid lägga till information manuellt under Inställningar senare.
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-center space-y-2">
          <p className="text-sm text-white/60">Ni hoppar över hemsida-steget.</p>
        </div>
        <button
          onClick={() => onNext([])}
          className="w-full px-4 py-2.5 rounded-xl bg-primary text-[#030614] text-sm font-semibold hover:bg-cyan-300 transition-colors"
        >
          Fortsätt →
        </button>
        <button onClick={() => setNoSite(false)} className="w-full text-xs text-muted-foreground hover:text-white transition-colors">
          ← Tillbaka
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Har ni en hemsida?</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Vi läser av er hemsida och fyller i vanliga frågor &amp; svar automatiskt — priser, öppettider, vad ni erbjuder.
          Det sparar er mycket tid i nästa steg.
        </p>
      </div>

      {scraped !== null ? (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-2">
          <p className="text-sm font-semibold text-green-400">
            ✓ {scraped.length > 0 ? `${scraped.length} svar importerade från hemsidan` : "Hemsidan scannades — inga tydliga svar hittades"}
          </p>
          <p className="text-xs text-muted-foreground">
            {scraped.length > 0
              ? "AI:n kan nu använda denna info direkt. Ni kan alltid redigera under Inställningar."
              : "Ni kan lägga till svar manuellt under Inställningar → Kunskapsbas senare."}
          </p>
        </div>
      ) : (
        <>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Hemsidans adress
            </label>
            <div className="flex items-center">
              <span className="text-xs text-muted-foreground/60 px-3 py-2.5 bg-white/5 border border-r-0 border-white/10 rounded-l-lg select-none">
                https://
              </span>
              <input
                type="text"
                inputMode="url"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); scrape(); } }}
                placeholder="energikompaniet.se"
                className="flex-1 bg-white/5 text-white text-sm rounded-r-lg px-3 py-2.5 border border-white/10 focus:border-primary/50 focus:outline-none placeholder:text-muted-foreground/40"
              />
            </div>
            {!valid && domain.trim().length > 0 && (
              <p className="text-[11px] text-amber-400 mt-1">
                Det ser inte ut som en webbadress — försök t.ex. <span className="font-mono">energikompaniet.se</span>.
              </p>
            )}
          </div>
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <button
            onClick={scrape}
            disabled={scraping || !domain.trim() || !valid}
            className="w-full px-4 py-2.5 rounded-xl bg-primary text-[#030614] text-sm font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40"
          >
            {scraping ? "Läser hemsidan…" : "Hämta info från hemsidan →"}
          </button>
        </>
      )}

      {scraped !== null && (
        <button
          onClick={() => onNext(scraped)}
          className="w-full px-4 py-2.5 rounded-xl bg-primary text-[#030614] text-sm font-semibold hover:bg-cyan-300 transition-colors"
        >
          Fortsätt →
        </button>
      )}

      <button
        onClick={() => setNoSite(true)}
        className="w-full text-xs text-muted-foreground hover:text-white transition-colors"
      >
        Vi har ingen hemsida →
      </button>
    </div>
  );
}

// ── Step 3: Case types ─────────────────────────────────────────────────────────

const DEFAULT_CASE_TYPES: CaseTypeOption[] = [
  { slug: "offert",      label: "Offertförfrågan",   checked: true },
  { slug: "bokning",     label: "Bokningsförfrågan",  checked: true },
  { slug: "reklamation", label: "Reklamation",        checked: true },
  { slug: "ovrigt",      label: "Övrigt",             checked: true },
];

function CaseTypesStep({ onNext }: { onNext: () => void }) {
  const [options, setOptions]     = useState<CaseTypeOption[]>(DEFAULT_CASE_TYPES);
  const [customLabel, setCustomLabel] = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const selected = options.filter(o => o.checked);

  const toggle = (slug: string) =>
    setOptions(prev => prev.map(o => o.slug === slug ? { ...o, checked: !o.checked } : o));

  const addCustom = () => {
    const label = customLabel.trim();
    if (!label) return;
    const slug = label.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 40) + "_" + Date.now().toString(36);
    setOptions(prev => [...prev, { slug, label, checked: true, custom: true }]);
    setCustomLabel("");
  };

  const removeCustom = (slug: string) =>
    setOptions(prev => prev.filter(o => o.slug !== slug));

  const handleNext = async () => {
    if (selected.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        selected.map((ct, i) =>
          fetch("/api/app/case-types", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              slug:      ct.slug,
              label:     ct.label,
              isDefault: ct.slug === "ovrigt",
              sortOrder: i,
            }),
          })
        )
      );
      onNext();
    } catch {
      setError("Kunde inte spara ärendetyper. Försök igen.");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Vilka typer av ärenden får ni?</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          AI:n sorterar varje inkommande mejl i rätt ärendetyp automatiskt — så att ni alltid ser vad som är vad
          och kan hantera rätt ärenden först. Välj de som stämmer in på er verksamhet.
        </p>
      </div>

      <div className="space-y-2">
        {options.map(opt => (
          <label
            key={opt.slug}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              opt.checked
                ? "border-primary/40 bg-primary/5 text-white"
                : "border-white/8 bg-white/[0.02] text-white/40 hover:text-white/70"
            }`}
          >
            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
              opt.checked ? "bg-primary border-primary" : "border-white/20"
            }`}>
              {opt.checked && <span className="text-[#030614] text-[10px] font-bold leading-none">✓</span>}
            </div>
            <span className="text-sm font-medium flex-1">{opt.label}</span>
            {opt.custom && (
              <button
                type="button"
                onClick={e => { e.preventDefault(); removeCustom(opt.slug); }}
                className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
              >
                Ta bort
              </button>
            )}
          </label>
        ))}
      </div>

      {/* Add custom */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customLabel}
          onChange={e => setCustomLabel(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder="Lägg till egen ärendetyp…"
          maxLength={80}
          className="flex-1 bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-primary/50 focus:outline-none placeholder:text-muted-foreground/40"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!customLabel.trim()}
          className="px-3 py-2 rounded-lg bg-white/8 text-white text-xs hover:bg-white/15 transition-colors disabled:opacity-40"
        >
          Lägg till
        </button>
      </div>

      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

      <div className="pt-1">
        <button
          onClick={handleNext}
          disabled={selected.length === 0 || saving}
          className="w-full px-4 py-2.5 rounded-xl bg-primary text-[#030614] text-sm font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40"
        >
          {saving ? "Sparar…" : `Fortsätt med ${selected.length} ärendetyp${selected.length !== 1 ? "er" : ""} →`}
        </button>
        {selected.length === 0 && (
          <p className="text-center text-[11px] text-amber-400 mt-2">Välj minst en ärendetyp för att fortsätta.</p>
        )}
      </div>
    </div>
  );
}

// ── Step 4: Webhooks ───────────────────────────────────────────────────────────

function WebhooksStep({ onFinish }: { onFinish: () => void }) {
  const [url, setUrl]         = useState("");
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const isValidUrl = (s: string) => { try { new URL(s); return true; } catch { return false; } };

  const save = async () => {
    if (!url.trim() || !isValidUrl(url) || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/app/webhooks", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: url.trim(), caseTypeSlug: "*" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Kunde inte spara");
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Vill ni koppla till andra system?</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Varje gång ett mejl klassificeras kan Mailmind automatiskt skicka en notis till ett annat system —
          t.ex. att ett nytt ärende dök upp i Slack, att en reklamation lagts in i ert CRM, eller att
          en offertförfrågan hamnade i ert affärssystem.
        </p>
      </div>

      {/* Plain-language explainer */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
        <p className="text-xs font-semibold text-white/70">Hur fungerar det?</p>
        <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
          <p>
            <span className="text-white/60 font-medium">1. Kunden skickar ett mejl</span> — t.ex. en offertförfrågan.
          </p>
          <p>
            <span className="text-white/60 font-medium">2. Mailmind klassificerar det</span> — AI:n ser att det är en Offertförfrågan.
          </p>
          <p>
            <span className="text-white/60 font-medium">3. Ert system får en notis</span> — inom sekunder skickas informationen
            vidare till den adress ni anger här, och ert system kan ta emot den och agera.
          </p>
        </div>
        <p className="text-[10px] text-muted-foreground pt-1 border-t border-white/5">
          Teknisk term för detta: <span className="text-white/40">webhook</span>. Fungerar med Slack, Zapier, Make, HubSpot, och de flesta moderna system.
        </p>
      </div>

      {saved ? (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
          <p className="text-sm font-semibold text-green-400">✓ Notifikation kopplad</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ni kan lägga till fler kopplingar under Inställningar → Webhooks.
          </p>
        </div>
      ) : (
        <>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Adress att skicka notisen till (valfritt)
            </label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://hooks.slack.com/…"
              className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2.5 border border-white/10 focus:border-primary/50 focus:outline-none placeholder:text-muted-foreground/40"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Har ni ingen nu? Hoppa över — det tar 30 sekunder att lägga till senare.
            </p>
          </div>
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          {url.trim() && (
            <button
              onClick={save}
              disabled={saving || !isValidUrl(url)}
              className="w-full px-4 py-2.5 rounded-xl bg-primary text-[#030614] text-sm font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40"
            >
              {saving ? "Kopplar…" : "Koppla och fortsätt →"}
            </button>
          )}
        </>
      )}

      <button
        onClick={onFinish}
        className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
          saved
            ? "bg-primary text-[#030614] hover:bg-cyan-300"
            : "border border-white/10 text-white/50 hover:text-white hover:border-white/30"
        }`}
      >
        {saved ? "Gå till Mailmind →" : "Hoppa över, gå till Mailmind →"}
      </button>
    </div>
  );
}

// ── Shell ──────────────────────────────────────────────────────────────────────

export function OnboardingForm({
  email,
  suggestedOrgName,
}: {
  email: string;
  suggestedOrgName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("workspace");

  const finish = () => {
    router.push("/app");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <ProgressBar current={step} />

      {step === "workspace" && (
        <WorkspaceStep
          email={email}
          suggestedOrgName={suggestedOrgName}
          onNext={() => setStep("website")}
        />
      )}
      {step === "website" && (
        <WebsiteStep
          onNext={() => setStep("casetypes")}
        />
      )}
      {step === "casetypes" && (
        <CaseTypesStep
          onNext={() => setStep("webhooks")}
        />
      )}
      {step === "webhooks" && (
        <WebhooksStep onFinish={finish} />
      )}
    </div>
  );
}
