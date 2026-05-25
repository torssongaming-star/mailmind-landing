/**
 * ConfidenceBadge — visar AI:s självrapporterade confidence för ett utkast.
 *
 * Fyra trösklar med tydlig SMB-vänlig läsning:
 *   ≥ 0.90  → grön   "92 % säker · auto-skickbar"
 *   0.70 +  → cyan   "78 % säker"
 *   0.50 +  → gul    "62 % säker · granska noga"
 *   < 0.50  → röd    "34 % säker · låg säkerhet"
 *
 * Tröskeln ≥ 0.90 mappar direkt mot AUTO_SEND_CONFIDENCE_THRESHOLD
 * i autoSend.ts och CLAUDE.md (låst produktbeslut). Är detta lager
 * synligt, vet SMB-användaren omedelbart om utkastet är auto-send-
 * kandidat eller inte.
 */

export function ConfidenceBadge({ confidence }: { confidence: number | null | undefined }) {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) return null;

  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  const tier = tierFor(confidence);
  const styles = TIER_STYLES[tier];

  return (
    <span
      className={[
        "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full leading-none border",
        styles.bg,
        styles.text,
        styles.border,
      ].join(" ")}
      title={styles.tooltip}
      aria-label={`AI-säkerhet ${pct} procent — ${styles.label}`}
    >
      <span className="tabular-nums">{pct}%</span>
      <span className="opacity-80">·</span>
      <span>{styles.label}</span>
    </span>
  );
}

// ── Trösklar ────────────────────────────────────────────────────────────────

type Tier = "green" | "cyan" | "amber" | "red";

function tierFor(c: number): Tier {
  if (c >= 0.90) return "green";
  if (c >= 0.70) return "cyan";
  if (c >= 0.50) return "amber";
  return "red";
}

const TIER_STYLES: Record<
  Tier,
  { bg: string; text: string; border: string; label: string; tooltip: string }
> = {
  green: {
    bg:      "bg-green-500/10",
    text:    "text-green-300",
    border:  "border-green-500/30",
    label:   "auto-skickbar",
    tooltip: "AI uppfyller tröskeln (≥ 90 %) för auto-send",
  },
  cyan: {
    bg:      "bg-primary/10",
    text:    "text-primary",
    border:  "border-primary/30",
    label:   "säker",
    tooltip: "Hög säkerhet, men under auto-send-tröskeln (90 %)",
  },
  amber: {
    bg:      "bg-amber-500/10",
    text:    "text-amber-300",
    border:  "border-amber-500/30",
    label:   "granska noga",
    tooltip: "Medelhög säkerhet — läs igenom innan du skickar",
  },
  red: {
    bg:      "bg-red-500/10",
    text:    "text-red-300",
    border:  "border-red-500/30",
    label:   "låg säkerhet",
    tooltip: "AI är osäker — skriv om eller eskalera",
  },
};
