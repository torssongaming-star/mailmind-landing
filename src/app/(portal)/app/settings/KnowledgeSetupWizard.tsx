"use client";

import { useState } from "react";

type Question = {
  question: string;
  category: string;
  hint:     string;
};

type Step = "intro" | "scraping" | "generating" | "answering" | "saving" | "done";

export function KnowledgeSetupWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep]               = useState<Step>("intro");
  const [error, setError]             = useState<string | null>(null);

  // Step 1 fields
  const [industry, setIndustry]       = useState("");
  const [description, setDescription] = useState("");
  const [contactAbout, setContactAbout] = useState("");
  const [siteUrl, setSiteUrl]         = useState("");

  // scrape results
  const [scrapedCount, setScrapedCount] = useState(0);

  // Step 2
  const [questions, setQuestions]     = useState<Question[]>([]);
  const [answers, setAnswers]         = useState<Record<number, string>>({});

  // ── Step 1 → generate questions ──────────────────────────────────────────
  const handleGenerate = async () => {
    if (!industry.trim() || !description.trim()) return;
    setError(null);

    let scrapedText: string | undefined;

    // Optional: scrape the website first
    if (siteUrl.trim()) {
      setStep("scraping");
      try {
        const res = await fetch("/api/app/knowledge/scrape", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ url: siteUrl.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.inserted > 0) {
          setScrapedCount(data.inserted);
          // Build a short text summary from the imported entries for AI context
          scrapedText = (data.entries as { question: string; answer: string }[] ?? [])
            .slice(0, 20)
            .map((e: { question: string; answer: string }) => `F: ${e.question}\nS: ${e.answer}`)
            .join("\n\n")
            .slice(0, 4000);
        }
      } catch {
        // Scrape failure is non-fatal — continue without site context
      }
    }

    setStep("generating");
    try {
      const res = await fetch("/api/app/knowledge/guided-setup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          action:       "generate_questions",
          businessName: "Mitt företag",
          industry:     industry.trim(),
          description:  description.trim(),
          contactAbout: contactAbout.trim() || undefined,
          scrapedText,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setQuestions(data.questions ?? []);
      setStep("answering");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel");
      setStep("intro");
    }
  };

  // ── Step 2 → save answers ────────────────────────────────────────────────
  const handleSave = async () => {
    const entries = questions
      .map((q, i) => ({ question: q.question, answer: answers[i] ?? "", category: q.category }))
      .filter(e => e.answer.trim().length > 0);

    if (entries.length === 0) {
      setError("Fyll i minst ett svar innan du sparar.");
      return;
    }

    setStep("saving");
    setError(null);
    try {
      const res = await fetch("/api/app/knowledge/guided-setup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "save_answers", entries }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Sparning misslyckades");
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel");
      setStep("answering");
    }
  };

  // ── Done ─────────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6 text-center space-y-3">
        <p className="text-2xl">✓</p>
        <p className="text-sm font-semibold text-green-400">Kunskapsbasen är uppsatt!</p>
        {scrapedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {scrapedCount} svar importerade från hemsidan + era egna svar sparade.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          AI:n kan nu använda denna information för att svara på kundfrågor.
        </p>
        <button
          onClick={onComplete}
          className="mt-2 px-4 py-2 rounded-lg bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors"
        >
          Visa kunskapsbasen
        </button>
      </div>
    );
  }

  // ── Answering ─────────────────────────────────────────────────────────────
  if (step === "answering" || step === "saving") {
    const answeredCount = Object.values(answers).filter(a => a.trim()).length;
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-white">Svara på frågorna</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hoppa över frågor som inte är relevanta. Ju fler svar, desto bättre blir AI:n.
          </p>
          {scrapedCount > 0 && (
            <p className="text-xs text-green-400 mt-1">
              ✓ {scrapedCount} svar importerade automatiskt från hemsidan
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">{error}</div>
        )}

        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="rounded-xl border border-white/8 bg-[#050B1C]/60 p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-white flex-1">{q.question}</p>
                <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full shrink-0">
                  {q.category}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground italic">{q.hint}</p>
              <textarea
                value={answers[i] ?? ""}
                onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                placeholder="Skriv ert svar här…"
                rows={2}
                className="w-full bg-white/5 text-white text-xs rounded-lg px-3 py-2 border border-white/10 focus:border-indigo-500/50 outline-none resize-none placeholder:text-white/30"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <p className="text-xs text-muted-foreground">{answeredCount} av {questions.length} besvarade</p>
          <button
            onClick={handleSave}
            disabled={step === "saving" || answeredCount === 0}
            className="px-4 py-2 rounded-lg bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40"
          >
            {step === "saving" ? "Sparar…" : "Spara i kunskapsbasen →"}
          </button>
        </div>
      </div>
    );
  }

  // ── Scraping / Generating spinners ────────────────────────────────────────
  if (step === "scraping" || step === "generating") {
    return (
      <div className="py-10 text-center space-y-3">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-muted-foreground">
          {step === "scraping"
            ? "Hämtar innehåll från hemsidan…"
            : "AI analyserar er bransch och genererar frågor…"}
        </p>
      </div>
    );
  }

  // ── Intro ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-white">Sätt upp er kunskapsbas</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Berätta lite om ert företag — AI:n genererar sedan de frågor som era kunder troligen ställer, så att ni snabbt kan fylla i svaren.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">{error}</div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Hemsida (valfritt)
          </label>
          <input
            type="text"
            value={siteUrl}
            onChange={e => setSiteUrl(e.target.value)}
            placeholder="T.ex. dittforetag.se/om-oss"
            className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-indigo-500/50 outline-none"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Om ni anger en URL importeras innehållet automatiskt och AI:n anpassar frågorna efter er hemsida.
          </p>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Bransch / typ av verksamhet *
          </label>
          <input
            type="text"
            value={industry}
            onChange={e => setIndustry(e.target.value)}
            placeholder="T.ex. byggentreprenad, redovisningsbyrå, tandläkarmottagning"
            className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-indigo-500/50 outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Vad gör ni? *
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="T.ex. Vi är en totalentreprenad som specialiserar oss på badrumsrenovering och kakelläggning i Stockholmsregionen."
            rows={3}
            className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-indigo-500/50 outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Vad kontaktar kunder er oftast om? (valfritt)
          </label>
          <input
            type="text"
            value={contactAbout}
            onChange={e => setContactAbout(e.target.value)}
            placeholder="T.ex. prisförfrågningar, bokningar, reklamationer"
            className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-indigo-500/50 outline-none"
          />
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={!industry.trim() || !description.trim()}
        className="w-full py-2.5 rounded-lg bg-primary text-[#030614] text-sm font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40"
      >
        {siteUrl.trim() ? "Hämta hemsida & generera frågor →" : "Generera frågor →"}
      </button>
    </div>
  );
}
