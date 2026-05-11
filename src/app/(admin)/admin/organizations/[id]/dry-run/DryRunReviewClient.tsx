"use client";

import { useTransition } from "react";
import { reviewDryRunDraftAction } from "@/lib/admin/actions";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type DryRunDraft = {
  id: string;
  action: "ask" | "summarize" | "escalate";
  bodyText: string | null;
  dryRunApproved: boolean | null;
  generatedAt: Date;
  thread: { id: string; subject: string | null; fromEmail: string } | null;
};

export function DryRunReviewClient({
  drafts,
  orgId,
}: {
  drafts: DryRunDraft[];
  orgId: string;
}) {
  return (
    <div className="space-y-4">
      {drafts.length === 0 && (
        <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-12 text-center space-y-3">
          <Clock className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-slate-400 text-sm">Inga dry-run-utkast än.</p>
          <p className="text-slate-600 text-xs">
            Aktivera dry-run-läget och skicka in testmejl via Outlook-tillägget eller inboxen.
          </p>
        </div>
      )}
      {drafts.map((draft) => (
        <DraftRow key={draft.id} draft={draft} orgId={orgId} />
      ))}
    </div>
  );
}

function DraftRow({ draft, orgId }: { draft: DryRunDraft; orgId: string }) {
  const [isPending, startTransition] = useTransition();

  const review = (approved: boolean) => {
    startTransition(async () => {
      await reviewDryRunDraftAction(draft.id, orgId, approved);
    });
  };

  const actionColors: Record<string, string> = {
    ask:       "text-cyan-300 bg-cyan-500/10 border-cyan-500/30",
    summarize: "text-blue-300 bg-blue-500/10 border-blue-500/30",
    escalate:  "text-red-300 bg-red-500/10 border-red-500/30",
  };

  return (
    <div className={cn(
      "bg-[#050B1C] border rounded-2xl p-6 space-y-4 transition-colors",
      draft.dryRunApproved === true  && "border-green-500/20",
      draft.dryRunApproved === false && "border-red-500/20",
      draft.dryRunApproved === null  && "border-white/5",
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <p className="text-white text-sm font-bold truncate">
            {draft.thread?.subject ?? "(inget ämne)"}
          </p>
          <p className="text-slate-500 text-[11px] truncate">
            {draft.thread?.fromEmail} · {format(new Date(draft.generatedAt), "d MMM HH:mm")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest",
            actionColors[draft.action] ?? "text-white bg-white/10 border-white/20"
          )}>
            {draft.action}
          </span>
          {draft.dryRunApproved === true && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-green-400">
              <CheckCircle2 className="w-3 h-3" /> Godkänd
            </span>
          )}
          {draft.dryRunApproved === false && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
              <XCircle className="w-3 h-3" /> Avslagen
            </span>
          )}
          {draft.dryRunApproved === null && (
            <span className="text-[10px] text-slate-500 font-medium">Ej granskad</span>
          )}
        </div>
      </div>

      {/* Draft body */}
      {draft.bodyText ? (
        <p className="text-slate-300 text-xs leading-relaxed bg-white/[0.02] rounded-xl p-4 border border-white/5 whitespace-pre-wrap">
          {draft.bodyText.slice(0, 600)}{draft.bodyText.length > 600 ? "…" : ""}
        </p>
      ) : (
        <p className="text-slate-600 text-xs italic">
          {draft.action === "escalate" ? "Ingen brödtext — eskalering utan svar." : "Inget utkast genererat."}
        </p>
      )}

      {/* Review buttons — only show when not yet reviewed */}
      {draft.dryRunApproved === null && (
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => review(true)}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Godkänn kvalitet
          </button>
          <button
            onClick={() => review(false)}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
            Avslå
          </button>
        </div>
      )}
    </div>
  );
}
