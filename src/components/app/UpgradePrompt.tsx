"use client";

/**
 * UpgradePrompt — client-side modal triggered when an action is blocked by
 * plan limits. Visas både i banners (passive nudge vid 80%+) och som modal
 * när 100% limit nåtts.
 *
 * Strategi-revision P5.1.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <UpgradePrompt
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     reason="ai_draft_limit_reached"
 *     used={500}
 *     limit={500}
 *     currentPlan="starter"
 *   />
 */

import Link from "next/link";
import { useEffect } from "react";
import { Zap, X, ArrowRight } from "lucide-react";

type Reason =
  | "ai_draft_limit_reached"
  | "inbox_limit_reached"
  | "user_limit_reached"
  | "past_due"
  | "no_subscription";

const CONTENT: Record<Reason, { title: string; body: string }> = {
  ai_draft_limit_reached: {
    title: "AI-kvoten är slut för månaden",
    body:  "Du har använt alla AI-utkast i din nuvarande plan. Uppgradera för att fortsätta generera svar — tar 1 minut.",
  },
  inbox_limit_reached: {
    title: "Inkorgs-platserna är fulla",
    body:  "Din plan tillåter ett begränsat antal inkorgar. Uppgradera för att koppla fler.",
  },
  user_limit_reached: {
    title: "Alla platser är fyllda",
    body:  "Du har bjudit in alla teammedlemmar din plan tillåter. Uppgradera för fler platser.",
  },
  past_due: {
    title: "Betalning misslyckades",
    body:  "Vi kunde inte dra din senaste betalning. Uppdatera din betalmetod för att fortsätta.",
  },
  no_subscription: {
    title: "Inget aktivt abonnemang",
    body:  "Välj en plan för att aktivera AI-funktionerna.",
  },
};

export function UpgradePrompt({
  open,
  onClose,
  reason,
  used,
  limit,
}: {
  open:     boolean;
  onClose:  () => void;
  reason:   Reason;
  used?:    number;
  limit?:   number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const c = CONTENT[reason];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-prompt-title"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-primary/25 bg-[hsl(var(--surface-elev-1))] backdrop-blur-xl p-6 shadow-[0_24px_80px_-20px_hsl(189_94%_43%/0.4)]"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-5">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center">
            <Zap size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="upgrade-prompt-title" className="text-base font-semibold text-white tracking-tight">{c.title}</h2>
            <p className="text-sm text-white/55 leading-relaxed mt-1.5">{c.body}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Stäng"
            className="shrink-0 text-white/40 hover:text-white transition-colors -mt-1 -mr-1"
          >
            <X size={16} />
          </button>
        </div>

        {used !== undefined && limit !== undefined && (
          <div className="mb-5">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-white/45 font-medium">Användning denna månad</span>
              <span className="text-white/70 tabular-nums font-semibold">{used.toLocaleString()} / {limit.toLocaleString()}</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-red-500 transition-all duration-500"
                style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center h-9 px-4 rounded-xl text-xs font-medium text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            Inte nu
          </button>
          <Link
            href="/dashboard/billing"
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-[hsl(var(--surface-base))] text-xs font-semibold hover:bg-cyan-300 transition-colors shadow-[0_4px_18px_-2px_hsl(189_94%_43%/0.45)]"
          >
            Se planer
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}
