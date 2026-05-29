/**
 * QuoteTimeline — renders a quote's workflow event history.
 *
 * Pure presentational server component. Events come from
 * listWorkflowEvents(orgId, quoteId) (oldest first); we render newest first.
 */

import type { WorkflowEvent } from "@/lib/quoting-common/domain/types";

const STAGE_LABELS: Record<string, string> = {
  draft:       "Utkast",
  calculating: "Beräknar",
  ready:       "Klar",
  sent:        "Skickad",
  viewed:      "Öppnad",
  accepted:    "Accepterad",
  signed:      "Signerad",
  rejected:    "Avvisad",
  expired:     "Utgången",
};

const STAGE_DOT: Record<string, string> = {
  draft:       "bg-white/30",
  calculating: "bg-blue-400",
  ready:       "bg-cyan-400",
  sent:        "bg-violet-400",
  viewed:      "bg-indigo-400",
  accepted:    "bg-emerald-400",
  signed:      "bg-emerald-300",
  rejected:    "bg-red-400",
  expired:     "bg-orange-400",
};

function label(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

export function QuoteTimeline({ events }: { events: WorkflowEvent[] }) {
  if (events.length === 0) return null;

  // Newest first
  const ordered = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <p className="text-sm font-semibold text-white mb-4">Händelser</p>
      <ol className="space-y-3">
        {ordered.map((e) => (
          <li key={e.id} className="flex items-start gap-3">
            <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${STAGE_DOT[e.toStage] ?? "bg-white/30"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/80">
                {e.fromStage ? (
                  <>
                    <span className="text-white/45">{label(e.fromStage)}</span>
                    <span className="text-white/30 mx-1.5">→</span>
                  </>
                ) : null}
                <span className="font-medium">{label(e.toStage)}</span>
              </p>
              {e.reason && <p className="text-[11px] text-white/45 mt-0.5 leading-relaxed">{e.reason}</p>}
            </div>
            <time className="text-[11px] text-white/30 shrink-0 tabular-nums">
              {new Date(e.createdAt).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
              {" "}
              {new Date(e.createdAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
            </time>
          </li>
        ))}
      </ol>
    </div>
  );
}
