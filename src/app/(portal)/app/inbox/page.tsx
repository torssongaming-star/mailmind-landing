/**
 * /app/inbox — split-pane email triage view.
 * Left: compact thread list. Right: thread content panel (client-side load).
 * Full viewport height, no dead space.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listThreads, wakeUpSnoozedThreads, listCaseTypes } from "@/lib/app/threads";
import { NewThreadButton } from "./NewThreadButton";
import { InboxFilters } from "./InboxFilters";
import { InboxShell } from "./InboxShell";

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

  const params      = await searchParams;
  const isOutlook   = params.source === "outlook";
  const filterStatus = VALID_STATUSES.includes(params.status as ThreadStatus)
    ? (params.status as ThreadStatus)
    : null;
  const query     = (params.q   ?? "").trim().toLowerCase();
  const tagFilter = (params.tag ?? "").trim().toLowerCase();

  await wakeUpSnoozedThreads(account.organization.id);

  const [all, caseTypesList] = await Promise.all([
    listThreads(account.organization.id, { limit: 200 }),
    listCaseTypes(account.organization.id),
  ]);

  const slaByCaseType: Record<string, number> = {};
  for (const ct of caseTypesList) {
    if (ct.slaHours != null) slaByCaseType[ct.slug] = ct.slaHours;
  }

  const threads = all.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (tagFilter && !(t.tags ?? []).includes(tagFilter)) return false;
    if (query) {
      const haystack = [t.subject ?? "", t.fromEmail, t.fromName ?? "", t.caseTypeSlug ?? "", ...(t.tags ?? [])].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const counts = {
    all:       all.length,
    open:      all.filter(t => t.status === "open").length,
    waiting:   all.filter(t => t.status === "waiting").length,
    escalated: all.filter(t => t.status === "escalated").length,
    resolved:  all.filter(t => t.status === "resolved").length,
  };

  // Outlook add-in: keep old compact single-column layout
  if (isOutlook) {
    const { InboxList } = await import("./InboxList");
    return (
      <main className="max-w-full p-4 space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Threads</h1>
          <NewThreadButton compact />
        </header>
        <InboxFilters currentStatus={filterStatus} currentQuery={query} currentTag={tagFilter || undefined} counts={counts} compact />
        <InboxList
          slaByCaseType={slaByCaseType}
          threads={threads.map(t => ({ id: t.id, subject: t.subject, fromEmail: t.fromEmail, fromName: t.fromName, status: t.status, caseTypeSlug: t.caseTypeSlug, lastMessageAt: t.lastMessageAt, snoozedUntil: t.snoozedUntil ?? null, tags: t.tags ?? [] }))}
        />
      </main>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 flex items-center gap-4 px-6 py-3 border-b border-white/8 bg-[#030614]">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none mb-0.5">Inbox</p>
          <h1 className="text-base font-bold text-white leading-none">
            Threads
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {threads.length}{threads.length !== all.length ? ` / ${all.length}` : ""}
            </span>
          </h1>
        </div>
        <div className="flex-1">
          <InboxFilters
            currentStatus={filterStatus}
            currentQuery={query}
            currentTag={tagFilter || undefined}
            counts={counts}
          />
        </div>
        <NewThreadButton />
      </header>

      {/* Split pane — fills remaining height */}
      {threads.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          {all.length === 0 ? (
            <>
              <p className="text-sm text-white/70">Inga trådar än</p>
              <p className="text-xs">Skapa en testtråd för att prova AI-utkast-flödet.</p>
              <NewThreadButton />
            </>
          ) : (
            <p className="text-sm">Inga trådar matchar filtret</p>
          )}
        </div>
      ) : (
        <InboxShell
          canGenerate={account.access.canGenerateAiDraft}
          slaByCaseType={slaByCaseType}
          threads={threads.map(t => ({
            id:            t.id,
            subject:       t.subject,
            fromEmail:     t.fromEmail,
            fromName:      t.fromName,
            status:        t.status,
            caseTypeSlug:  t.caseTypeSlug,
            lastMessageAt: t.lastMessageAt,
            snoozedUntil:  t.snoozedUntil ?? null,
            tags:          t.tags ?? [],
          }))}
        />
      )}
    </div>
  );
}
