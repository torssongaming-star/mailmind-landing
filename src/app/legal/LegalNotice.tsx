/**
 * LegalNotice — varningsbox högst upp i juridiska dokument.
 *
 * Tre nivåer av juridisk granskning:
 *   - lawyer:  KRÄVER advokatgranskning innan publicering
 *   - review:  rimlig template, bör läsas igenom + anpassas
 *   - ok:      säker att publicera (informativ, inte avtalsbunden)
 */

import { AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";

type Level = "lawyer" | "review" | "ok";

const CFG: Record<Level, { title: string; body: string; icon: React.ElementType; cls: string }> = {
  lawyer: {
    title: "Kräver juridisk granskning innan publicering",
    body:  "Det här är ett utkast/template. En svensk advokat med SaaS-/GDPR-erfarenhet ska gå igenom innehållet och anpassa till er verksamhet innan ni publicerar eller använder det i kundavtal. Räkna med 2–6 timmars advokattid (~5–15 000 SEK).",
    icon: AlertTriangle,
    cls:  "border-red-500/30 bg-red-500/[0.05] text-red-200",
  },
  review: {
    title: "Bör granskas och anpassas",
    body:  "Säker att använda som utgångspunkt, men gå igenom innehållet och anpassa till just er situation. Specifika siffror, datum, kontaktuppgifter och processer behöver fyllas i.",
    icon: AlertCircle,
    cls:  "border-amber-500/30 bg-amber-500/[0.05] text-amber-200",
  },
  ok: {
    title: "Klar att publicera",
    body:  "Informativ sida som beskriver ert nuvarande tillstånd. Uppdatera när faktiska förutsättningar ändras.",
    icon: CheckCircle2,
    cls:  "border-green-500/30 bg-green-500/[0.05] text-green-200",
  },
};

export function LegalNotice({ level, extra }: { level: Level; extra?: React.ReactNode }) {
  const cfg = CFG[level];
  const Icon = cfg.icon;
  return (
    <aside className={`not-prose rounded-2xl border ${cfg.cls} p-4 my-6 flex items-start gap-3`}>
      <Icon size={18} className="shrink-0 mt-0.5" />
      <div className="space-y-1.5 min-w-0">
        <p className="text-sm font-semibold leading-tight">{cfg.title}</p>
        <p className="text-xs leading-relaxed opacity-90">{cfg.body}</p>
        {extra && <div className="text-xs opacity-90 leading-relaxed">{extra}</div>}
      </div>
    </aside>
  );
}
