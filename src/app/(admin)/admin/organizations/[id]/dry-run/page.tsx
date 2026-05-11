import { notFound } from "next/navigation";
import Link from "next/link";
import { getDryRunStats, listDryRunDrafts, getAdminOrganization } from "@/lib/admin/queries";
import { DryRunReviewClient } from "./DryRunReviewClient";
import { DRY_RUN_THRESHOLD } from "@/lib/admin/constants";
import { ChevronLeft, FlaskConical, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function DryRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [org, stats, drafts] = await Promise.all([
    getAdminOrganization(id),
    getDryRunStats(id),
    listDryRunDrafts(id, 50),
  ]);

  if (!org) notFound();

  const approved  = stats?.approved  ?? 0;
  const total     = stats?.total     ?? 0;
  const threshold = DRY_RUN_THRESHOLD;
  const pct       = Math.min(100, Math.round((approved / threshold) * 100));
  const ready     = approved >= threshold;

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      {/* Back */}
      <Link
        href={`/admin/organizations/${id}`}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-medium transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Tillbaka till {org.name}
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <FlaskConical className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Dry-run granskning</h1>
          <p className="text-slate-400 text-sm mt-0.5">{org.name}</p>
        </div>
      </div>

      {/* Progress card */}
      <div className={cn(
        "bg-[#050B1C] border rounded-2xl p-6 space-y-4",
        ready ? "border-green-500/20" : "border-white/5"
      )}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
              Framsteg mot aktivering av autosvar
            </p>
            <p className="text-white text-lg font-bold">
              {approved} / {threshold} godkända iterationer
            </p>
            <p className="text-slate-500 text-xs mt-1">
              {total} utkast genererade totalt · {stats?.pending ?? 0} väntar på granskning
            </p>
          </div>
          {ready && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-green-300 text-xs font-bold">Klar för autosvar</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              ready
                ? "bg-gradient-to-r from-green-500 to-emerald-400"
                : "bg-gradient-to-r from-primary to-cyan-300"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        {!ready && (
          <p className="text-slate-500 text-xs">
            {threshold - approved} till till tröskeln ({threshold}). Mailmind-teamet aktiverar autosvar manuellt när tröskeln är nådd.
          </p>
        )}
        {ready && (
          <p className="text-green-400/70 text-xs">
            Tröskeln uppnådd. Gå till org-detaljsidan och aktivera autosvar under AI-inställningar.
          </p>
        )}
      </div>

      {/* Draft list */}
      <div className="space-y-3">
        <h2 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
          Dry-run-utkast ({drafts.length})
        </h2>
        <DryRunReviewClient
          drafts={drafts.map(d => ({
            id:             d.id,
            action:         d.action,
            bodyText:       d.bodyText,
            dryRunApproved: d.dryRunApproved ?? null,
            generatedAt:    d.generatedAt,
            thread:         d.thread
              ? { id: d.thread.id, subject: d.thread.subject ?? null, fromEmail: d.thread.fromEmail }
              : null,
          }))}
          orgId={id}
        />
      </div>
    </div>
  );
}
