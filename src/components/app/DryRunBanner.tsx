/**
 * DryRunBanner — visas överst i thread-vyn när organisationen kör dry-run.
 *
 * Dry-run innebär att AI-utkast genereras och loggas men INTE skickas till
 * kund — även om alla auto-send-villkor är uppfyllda. SMB-användaren ska
 * direkt se att läget är aktivt, annars riskerar man att tro att ett klick
 * på "Skicka svar" verkligen skickar till kund (det gör det inte i dry-run).
 *
 * Detta är 1 av 3 LOCKED produktbeslut i CLAUDE.md:
 *   "Dry-run ska användas innan autosvar aktiveras"
 *
 * Komponenten är skuldfri server-side renderbar (ingen "use client").
 */

export function DryRunBanner({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] shadow-[0_2px_24px_-12px_rgba(251,191,36,0.4)] px-4 py-3 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="shrink-0 w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-amber-400"
          aria-hidden
        >
          <path d="M2 12a10 10 0 1 0 20 0 10 10 0 0 0-20 0Z" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-100 leading-tight">
          Dry-run aktivt
        </p>
        <p className="text-xs text-amber-100/70 leading-relaxed mt-0.5">
          Utkast genereras och loggas men skickas <strong>inte</strong> till
          kunden. Använd godkännanden här för att träna AI:n innan
          auto-svar slås på i Inställningar.
        </p>
      </div>
    </div>
  );
}
