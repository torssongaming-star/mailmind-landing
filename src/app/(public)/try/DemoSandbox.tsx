"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, CheckCircle, HelpCircle, AlertTriangle, Zap, RotateCcw, Lock, Send } from "lucide-react";
import Link from "next/link";
import { captureEvent } from "@/lib/client/analytics";
import type { DemoExample, DemoTriageResult, ExampleId, DemoHistoryEntry } from "@/app/api/public/demo-triage/route";

// ── Example selector card ─────────────────────────────────────────────────────

function ExampleCard({
  example,
  selected,
  onClick,
}: {
  example: DemoExample;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full text-left rounded-2xl border p-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        selected
          ? "border-primary/50 bg-primary/[0.07] shadow-[0_0_0_1px_hsl(189_94%_43%/0.2)]"
          : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">{example.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${selected ? "text-white" : "text-white/80"}`}>
            {example.label}
          </p>
          <p className="text-xs text-white/65 mt-0.5 truncate">{example.description}</p>
        </div>
        {selected && (
          <div className="shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />
        )}
      </div>
    </button>
  );
}

// ── Email preview ─────────────────────────────────────────────────────────────

function EmailPreview({ example }: { example: DemoExample }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-white/10 bg-[hsl(var(--surface-elev-1))]/60 overflow-hidden"
    >
      {/* Email header */}
      <div className="px-5 py-4 border-b border-white/8 bg-white/[0.02]">
        <div className="flex items-center gap-2 text-xs text-white/65 mb-1">
          <span className="font-medium text-white/60">Från:</span>
          <span>{example.from}</span>
        </div>
        <p className="text-sm font-semibold text-white">{example.subject}</p>
      </div>
      {/* Email body */}
      <div className="px-5 py-4">
        <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">{example.body}</p>
      </div>
    </motion.div>
  );
}

// ── Result display ────────────────────────────────────────────────────────────

const ACTION_CONFIG = {
  summarize: {
    icon:    CheckCircle,
    label:   "Svar klart att skicka",
    color:   "text-green-400",
    border:  "border-green-500/25",
    bg:      "bg-green-500/[0.06]",
    iconBg:  "bg-green-500/10",
  },
  ask: {
    icon:    HelpCircle,
    label:   "Behöver mer info",
    color:   "text-blue-400",
    border:  "border-blue-500/25",
    bg:      "bg-blue-500/[0.06]",
    iconBg:  "bg-blue-500/10",
  },
  escalate: {
    icon:    AlertTriangle,
    label:   "Eskalerar till agent",
    color:   "text-amber-400",
    border:  "border-amber-500/25",
    bg:      "bg-amber-500/[0.06]",
    iconBg:  "bg-amber-500/10",
  },
  ignore: {
    icon:    AlertTriangle,
    label:   "Filtrerat som reklam/auto-mejl",
    color:   "text-white/40",
    border:  "border-white/10",
    bg:      "bg-white/[0.03]",
    iconBg:  "bg-white/5",
  },
} as const;

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-green-400" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
        />
      </div>
      <span className={`text-xs font-mono font-semibold tabular-nums ${color}`}>{pct}%</span>
    </div>
  );
}

function TriageResult({
  result,
  exampleId,
}: {
  result: DemoTriageResult;
  exampleId: ExampleId;
}) {
  const cfg = ACTION_CONFIG[result.action];
  const Icon = cfg.icon;

  return (
    <motion.div
      key={exampleId + result.action}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`rounded-2xl border ${cfg.border} ${cfg.bg} overflow-hidden`}
    >
      {/* Action header */}
      <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${cfg.iconBg} flex items-center justify-center shrink-0`}>
          <Icon size={16} className={cfg.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-widest ${cfg.color}`}>
              AI-beslut
            </span>
            <span className="text-[10px] text-white/30">•</span>
            <span className="text-xs font-semibold text-white/80">{cfg.label}</span>
            {result.caseType && (
              <>
                <span className="text-[10px] text-white/30">•</span>
                <span className="text-[10px] uppercase tracking-wider text-white/65 font-medium">
                  {result.caseType}
                </span>
              </>
            )}
          </div>
        </div>
        {result.fromCache && (
          <span className="text-[9px] uppercase tracking-wider text-white/25 shrink-0">cachad</span>
        )}
      </div>

      {/* Draft / question / reason */}
      {result.draft && (
        <div className="px-5 py-4 border-b border-white/8">
          <p className="text-[10px] uppercase tracking-widest text-white/60 font-semibold mb-2">
            {result.action === "summarize" ? "Föreslaget svar till kund" : "Följdfråga till kund"}
          </p>
          <p className="text-sm text-white/85 leading-relaxed whitespace-pre-line">{result.draft}</p>
        </div>
      )}

      {/* Confidence */}
      <div className="px-5 py-3 border-b border-white/8">
        <p className="text-[10px] uppercase tracking-widest text-white/60 font-semibold mb-2">
          Konfidens
        </p>
        <ConfidenceBar value={result.confidence} />
      </div>

      {/* Sources */}
      {result.sources.length > 0 && (
        <div className="px-5 py-3">
          <p className="text-[10px] uppercase tracking-widest text-white/60 font-semibold mb-2">
            Källhänvisningar
          </p>
          <ul className="space-y-1.5">
            {result.sources.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-white/55">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                <span>{s.snippet}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}

// ── Main sandbox ──────────────────────────────────────────────────────────────

export function DemoSandbox({ examples }: { examples: DemoExample[] }) {
  const [selectedId, setSelectedId]   = useState<ExampleId | null>(null);
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<DemoTriageResult | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [history, setHistory]         = useState<DemoHistoryEntry[]>([]);
  const [replyText, setReplyText]     = useState("");

  const selectedExample = examples.find(e => e.id === selectedId) ?? null;
  const isBlocked       = result?.blocked ?? false;

  const selectExample = (id: ExampleId) => {
    if (id === selectedId) return;
    setSelectedId(id);
    setResult(null);
    setError(null);
    setHistory([]);
    setReplyText("");
    captureEvent("demo.example_selected", { exampleId: id });
  };

  const runTriage = async () => {
    if (!selectedId || loading || !selectedExample) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/public/demo-triage", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ exampleId: selectedId }),
      });

      if (res.status === 429) {
        setError("För många förfrågningar — vänta en stund och försök igen.");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Något gick fel. Försök igen.");
        return;
      }

      setResult(data as DemoTriageResult);
      // Seed history with the initial customer email + AI's first response
      setHistory([
        { role: "customer",  body: selectedExample.body },
        { role: "assistant", body: data.draft ?? "" },
      ]);
      captureEvent("demo.triage_completed", {
        exampleId:  selectedId,
        action:     data.action,
        confidence: data.confidence,
      });
    } catch {
      setError("Kunde inte nå servern. Kontrollera anslutningen och försök igen.");
    } finally {
      setLoading(false);
    }
  };

  const sendReply = async () => {
    if (!selectedId || !replyText.trim() || loading || isBlocked) return;
    setLoading(true);
    setError(null);

    const userMsg = replyText.trim();

    try {
      const res = await fetch("/api/public/demo-triage", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          exampleId: selectedId,
          history,
          userReply: userMsg,
        }),
      });

      if (res.status === 429) {
        setError("För många förfrågningar — vänta en stund och försök igen.");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Något gick fel. Försök igen.");
        return;
      }

      setResult(data as DemoTriageResult);
      setHistory(prev => [
        ...prev,
        { role: "customer",  body: userMsg },
        { role: "assistant", body: data.draft ?? "" },
      ]);
      setReplyText("");
      captureEvent("demo.triage_followup", {
        exampleId:  selectedId,
        action:     data.action,
        confidence: data.confidence,
      });
    } catch {
      setError("Kunde inte nå servern. Kontrollera anslutningen och försök igen.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSelectedId(null);
    setResult(null);
    setError(null);
    setHistory([]);
    setReplyText("");
  };

  return (
    <div className="space-y-6">
      {/* Step 1 — Pick an email */}
      <div>
        <p className="text-[11px] uppercase tracking-widest text-white/60 font-semibold mb-3">
          1 — Välj ett inkommande mejl
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {examples.map(ex => (
            <ExampleCard
              key={ex.id}
              example={ex}
              selected={selectedId === ex.id}
              onClick={() => selectExample(ex.id)}
            />
          ))}
        </div>
      </div>

      {/* Step 2 — Preview + trigger */}
      <AnimatePresence mode="wait">
        {selectedExample && (
          <motion.div
            key={selectedExample.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <p className="text-[11px] uppercase tracking-widest text-white/60 font-semibold">
              2 — Mejlets innehåll
            </p>
            <EmailPreview example={selectedExample} />

            {!result && (
              <motion.button
                onClick={runTriage}
                disabled={loading}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-12 rounded-xl bg-primary text-[hsl(var(--surface-base))] text-sm font-semibold hover:bg-cyan-300 transition-all shadow-[0_4px_24px_-2px_hsl(189_94%_43%/0.45)] hover:shadow-[0_6px_32px_-2px_hsl(189_94%_43%/0.6)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Triagerar…
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    Triagera med AI
                  </>
                )}
              </motion.button>
            )}

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
              >
                {error}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 3 — Result */}
      <AnimatePresence>
        {result && selectedId && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <p className="text-[11px] uppercase tracking-widest text-white/60 font-semibold">
              3 — AI:ns svar {result.turn ? `(${result.turn} av ${result.maxTurns ?? 2})` : ""}
            </p>
            <TriageResult result={result} exampleId={selectedId} />

            {/* Step 4 — Customer reply field (only on turn 1 and when AI asked a follow-up) */}
            {!isBlocked && result.action === "ask" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.2 }}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3"
              >
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-white/60 font-semibold mb-1">
                    4 — Svara som kund
                  </p>
                  <p className="text-xs text-white/70 leading-relaxed">
                    Föreställ dig att du är kunden — svara på AI:ns följdfråga och se hur AI:n hanterar nästa runda.
                  </p>
                </div>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Skriv ditt svar här…"
                  rows={3}
                  maxLength={2000}
                  disabled={loading}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-primary/40 focus:outline-none transition-colors resize-none disabled:opacity-50"
                />
                <button
                  onClick={sendReply}
                  disabled={loading || !replyText.trim()}
                  className="w-full h-11 rounded-xl bg-primary text-[hsl(var(--surface-base))] text-sm font-semibold hover:bg-cyan-300 transition-all shadow-[0_4px_18px_-2px_hsl(189_94%_43%/0.4)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      AI tänker…
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Skicka svar till AI:n
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {/* Demo limit reached → friendly upgrade gate */}
            {isBlocked && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] p-6 text-center space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center mx-auto">
                  <Lock size={18} className="text-primary" />
                </div>
                <p className="text-sm font-semibold text-white">
                  Demon stannar här — men AI:n är redo för mer.
                </p>
                <p className="text-xs text-white/70 max-w-sm mx-auto leading-relaxed">
                  Skapa ett konto så hanterar den era riktiga kundmejl —
                  i er ton, med er kunskap.
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-[hsl(var(--surface-base))] text-sm font-semibold hover:bg-cyan-300 transition-all shadow-[0_4px_18px_-2px_hsl(189_94%_43%/0.4)]"
                  onClick={() => captureEvent("demo.upgrade_cta_clicked", { source: "limit_reached" })}
                >
                  Skapa ditt konto gratis
                  <ArrowRight size={14} />
                </Link>
                <p className="text-[11px] text-white/30">
                  Inget kreditkort krävs · 14 dagars gratis prov
                </p>
              </motion.div>
            )}

            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white/85 transition-colors mx-auto"
            >
              <RotateCcw size={11} />
              Testa ett annat mejl
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 text-center space-y-3"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
          <Zap size={18} className="text-primary" />
        </div>
        <p className="text-sm font-semibold text-white">
          Imponerad? Koppla din riktiga inkorg.
        </p>
        <p className="text-xs text-white/70 max-w-sm mx-auto leading-relaxed">
          Det du just såg var ett demo med ett fiktivt företag. I din version lär sig
          AI:n din verksamhet och svarar på dina riktiga kundfrågor.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-[hsl(var(--surface-base))] text-sm font-semibold hover:bg-cyan-300 transition-all shadow-[0_4px_18px_-2px_hsl(189_94%_43%/0.4)]"
        >
          Skapa ditt konto gratis
          <ArrowRight size={14} />
        </Link>
        <p className="text-[11px] text-white/30">
          Ingen kreditkort krävs · 14 dagars gratis prov
        </p>
      </motion.div>
    </div>
  );
}
