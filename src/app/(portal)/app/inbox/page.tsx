/**
 * /app/inbox — list of email threads.
 *
 * Phase 2 minimum viable UI. Until inbox connectors land, threads are created
 * via the "New test thread" button which posts to /api/app/threads.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listThreads, wakeUpSnoozedThreads, listCaseTypes } from "@/lib/app/threads";
import { NewThreadButton } from "./NewThreadButton";
import { InboxFilters } from "./InboxFilters";
import { InboxList } from "./InboxList";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["open", "waiting", "escalated", "resolved"] as const;
type ThreadStatus = (typeof VALID_STATUSES)[number];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; source?: string; tag?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");

  const params = await searchParams;
  const isOutlook = params.source === "outlook";
  const filterStatus = VALID_STATUSES.includes(params.status as ThreadStatus)
    ? (params.status as ThreadStatus)
    : null;
  const query   = (params.q   ?? "").trim().toLowerCase();
  const tagFilter = (params.tag ?? "").trim().toLowerCase();

  // Wake up any threads whose snooze has expired before listing
  await wakeUpSnoozedThreads(account.organization.id);

  const [all, caseTypesList] = await Promise.all([
    listThreads(account.organization.id, { limit: 200 }),
    listCaseTypes(account.organization.id),
  ]);

  const slaByCaseType: Record<string, number> = {};
  for (const ct of caseTypesList) {
    if (ct.slaHours != null) slaByCaseType[ct.slug] = ct.slaHours;
  }

  // Filter on the server so the count + list always agree
  const threads = all.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (tagFilter && !(t.tags ?? []).includes(tagFilter)) return false;
    if (query) {
      const haystack = [
        t.subject ?? "",
        t.fromEmail ?? "",
        t.fromName ?? "",
        t.caseTypeSlug ?? "",
        ...(t.tags ?? []),
      ].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  // Counts per status for the filter bar
  const counts = {
    all:        all.length,
    open:       all.filter(t => t.status === "open").length,
    waiting:    all.filter(t => t.status === "waiting").length,
    escalated:  all.filter(t => t.status === "escalated").length,
    resolved:   all.filter(t => t.status === "resolved").length,
  };

  return (
    <main className={isOutlook 
      ? "max-w-full p-4 space-y-4" 
      : "max-w-4xl mx-auto p-6 md:p-10 space-y-6"
    }>
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Inbox</p>
          <h1 className={isOutlook ? "text-xl font-bold text-white" : "text-2xl font-bold text-white"}>
            Threads
          </h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {threads.length} of {all.length} {isOutlook ? "items" : "threads"}
          </p>
        </div>
        <div className="flex gap-2">
          <NewThreadButton compact={isOutlook} />
        </div>
      </header>

      <InboxFilters
        currentStatus={filterStatus}
        currentQuery={query}
        currentTag={tagFilter || undefined}
        counts={counts}
        compact={isOutlook}
      />

      {threads.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-10 text-center">
          {all.length === 0 ? (
            <>
              <p className="text-white/70 text-sm mb-1">No threads yet</p>
              <p className="text-xs text-muted-foreground mb-4">
                Create a test thread to try the AI draft flow before connecting a real inbox.
              </p>
              <NewThreadButton />
            </>
          ) : (
            <>
              <p className="text-white/70 text-sm mb-1">No threads match your filter</p>
              <p className="text-xs text-muted-foreground">Clear the filter or search to see all {all.length} threads.</p>
            </>
          )}
        </div>
      ) : (
        <InboxList
          slaByCaseType={slaByCaseType}
          threads={threads.map(t => ({
            id:             t.id,
            subject:        t.subject,
            fromEmail:      t.fromEmail,
            fromName:       t.fromName,
            status:         t.status,
            caseTypeSlug:   t.caseTypeSlug,
            lastMessageAt:  t.lastMessageAt,
            snoozedUntil:   t.snoozedUntil ?? null,
            tags:           t.tags ?? [],
          }))}
        />
      )}
    </main>
  );
}
