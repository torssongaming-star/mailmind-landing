import Link from "next/link";
import type { EmailThread } from "@/lib/db/schema";

const STATUS_CLASSES: Record<string, string> = {
  open:      "bg-green-500/15 text-green-400 border-green-500/30",
  waiting:   "bg-amber-500/15 text-amber-400 border-amber-500/30",
  escalated: "bg-red-500/15 text-red-400 border-red-500/30",
  resolved:  "bg-white/10 text-muted-foreground border-white/15",
};

export function CustomerHistory({
  fromEmail,
  threads,
}: {
  fromEmail: string;
  threads: Pick<EmailThread, "id" | "subject" | "status" | "caseTypeSlug" | "lastMessageAt" | "createdAt">[];
}) {
  if (threads.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        Tidigare ärenden från {fromEmail}
      </h2>
      <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 divide-y divide-white/5 overflow-hidden">
        {threads.map(t => (
          <Link
            key={t.id}
            href={`/app/thread/${t.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{t.subject ?? "(inget ämne)"}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t.caseTypeSlug && <><span>{t.caseTypeSlug}</span> · </>}
                {t.createdAt
                  ? new Date(t.createdAt).toLocaleDateString("sv-SE")
                  : "—"}
              </p>
            </div>
            <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              STATUS_CLASSES[t.status] ?? STATUS_CLASSES.resolved
            }`}>
              {t.status}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
