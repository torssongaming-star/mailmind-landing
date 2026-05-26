/**
 * /app/inbox — split-pane email triage view.
 * Left: compact thread list. Right: thread content panel (client-side load).
 * Full viewport height, no dead space.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listThreads, wakeUpSnoozedThreads, listCaseTypes, countSnoozedThreads, searchThreads, listInboxes, getAiSettings, getPendingDraftConfidencesByThread } from "@/lib/app/threads";
import { NewThreadButton } from "./NewThreadButton";
import { InboxFilters } from "./InboxFilters";
import { InboxShell } from "./InboxShell";
import { InboxEmptyState } from "./InboxEmptyState";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Inkorg" };

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["open", "waiting", "escalated", "resolved"] as const;
type ThreadStatus = (typeof VALID_STATUSES)[number];
const SNOOZED  = "snoozed"  as const;
/** Pseudo-status: shows threads auto-filtered as bulk/marketing by the bulk-filter. */
const FILTERED = "filtered" as const;

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; source?: string; tag?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");

  const params         = await searchParams;
  const isOutlook      = params.source === "outlook";
  const isSnoozedView  = params.status === SNOOZED;
  const isFilteredView = params.status === FILTERED;
  const filterStatus = VALID_STATUSES.includes(params.status as ThreadStatus)
    ? (params.status as ThreadStatus)
    : null;
  const query     = (params.q   ?? "").trim().toLowerCase();
  const tagFilter = (params.tag ?? "").trim().toLowerCase();

  await wakeUpSnoozedThreads(account.organization.id);

  // Server-side search bypasses the 200-row limit. Falls back to in-memory
  // filtering for facets (status, tag) on top of the search result.
  const useServerSearch = query.length >= 2;
  const [mainPage, caseTypesList, snoozedCount, filteredCount, orgInboxes, aiSettings] = await Promise.all([
    useServerSearch
      ? searchThreads(account.organization.id, query, 200).then(threads => ({ threads, nextCursor: null }))
      : isSnoozedView
        ? listThreads(account.organization.id, { limit: 200, showSnoozed: true })
        : isFilteredView
          ? listThreads(account.organization.id, { limit: 200, caseTypeSlug: "bulk" })
          : listThreads(account.organization.id, { limit: 200 }),
    listCaseTypes(account.organization.id),
    countSnoozedThreads(account.organization.id),
    // Count of auto-filtered bulk threads (used by the tab badge).
    listThreads(account.organization.id, { limit: 200, caseTypeSlug: "bulk" }).then(({ threads }) => threads.length),
    listInboxes(account.organization.id),
    getAiSettings(account.organization.id),
  ]);
  const dryRunEnabled = aiSettings?.dryRunEnabled ?? false;
  const all             = mainPage.threads;
  const initialNextCursor = mainPage.nextCursor;
  const firstInboxEmail = orgInboxes[0]?.email ?? null;

  const slaByCaseType: Record<string, number> = {};
  for (const ct of caseTypesList) {
    if (ct.slaHours != null) slaByCaseType[ct.slug] = ct.slaHours;
  }

  // Hämta AI-confidence per tråd (senaste pending/edited utkast). En query för
  // alla 200 trådar, mappas in i raden så InboxList kan visa kompakt pill.
  const confidenceByThread = await getPendingDraftConfidencesByThread(
    account.organization.id,
    all.map(t => t.id),
  );

  const threads = all.filter(t => {
    // Hide bulk-filtered threads from the default views (only show them on the Reklam tab)
    if (!isFilteredView && t.caseTypeSlug === "bulk") return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (tagFilter && !(t.tags ?? []).includes(tagFilter)) return false;
    // Local search still applied when server-side returned a superset
    // (or for short queries — server-search threshold is 2 chars).
    if (query && !useServerSearch) {
      const haystack = [t.subject ?? "", t.fromEmail, t.fromName ?? "", t.caseTypeSlug ?? "", ...(t.tags ?? [])].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const counts = {
    all:       all.filter(t => t.caseTypeSlug !== "bulk").length,
    open:      all.filter(t => t.status === "open"      && t.caseTypeSlug !== "bulk").length,
    waiting:   all.filter(t => t.status === "waiting"   && t.caseTypeSlug !== "bulk").length,
    escalated: all.filter(t => t.status === "escalated" && t.caseTypeSlug !== "bulk").length,
    resolved:  all.filter(t => t.status === "resolved"  && t.caseTypeSlug !== "bulk").length,
    snoozed:   snoozedCount,
    filtered:  filteredCount,
  };

  // Outlook add-in: keep old compact single-column layout
  if (isOutlook) {
    const { InboxList } = await import("./InboxList");
    return (
      <main className="max-w-full p-4 space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Trådar</h1>
          <NewThreadButton compact />
        </header>
        <InboxFilters currentStatus={filterStatus} currentQuery={query} currentTag={tagFilter || undefined} counts={counts} compact />
        <InboxList
          slaByCaseType={slaByCaseType}
          threads={threads.map(t => ({ id: t.id, subject: t.subject, fromEmail: t.fromEmail, fromName: t.fromName, status: t.status, caseTypeSlug: t.caseTypeSlug, lastMessageAt: t.lastMessageAt, snoozedUntil: t.snoozedUntil ?? null, tags: t.tags ?? [], triageFailed: t.triageFailed ?? false, confidence: confidenceByThread.get(t.id) ?? null }))}
        />
      </main>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 border-b border-white/8 bg-[#030614]">
        {/* Main row: title + desktop filters + button */}
        <div className="flex items-center gap-4 px-6 py-3">
          <div className="hidden md:block">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none mb-0.5">Inkorg</p>
            <h1 className="text-base font-bold text-white leading-none">
              Trådar
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {threads.length}{threads.length !== all.length ? ` / ${all.length}` : ""}
              </span>
            </h1>
          </div>
          {/* Desktop filters inline */}
          <div className="hidden md:flex flex-1">
            <InboxFilters
              currentStatus={filterStatus}
              currentQuery={query}
              currentTag={tagFilter || undefined}
              counts={counts}
            />
          </div>
          <NewThreadButton />
        </div>
        {/* Mobile-only filter row — full width below the top bar */}
        <div className="md:hidden px-4 pb-3">
          <InboxFilters
            currentStatus={filterStatus}
            currentQuery={query}
            currentTag={tagFilter || undefined}
            counts={counts}
          />
        </div>
      </header>

      {/* Split pane — fills remaining height */}
      {threads.length === 0 ? (
        all.length === 0 ? (
          // Per-tab empty messaging — only the default inbox view should
          // show the welcome/"send a test mail" state. On filter tabs we
          // tell the user the tab is empty, not the whole inbox.
          isFilteredView ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <p className="text-sm text-white/70">Inga mejl klassade som reklam just nu</p>
              <Link
                href="/app/inbox"
                className="text-xs text-primary hover:text-cyan-300 transition-colors inline-flex items-center gap-1"
              >
                ← Tillbaka till alla trådar
              </Link>
            </div>
          ) : isSnoozedView ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <p className="text-sm text-white/70">Inga snoozade trådar just nu</p>
              <Link
                href="/app/inbox"
                className="text-xs text-primary hover:text-cyan-300 transition-colors inline-flex items-center gap-1"
              >
                ← Tillbaka till alla trådar
              </Link>
            </div>
          ) : (
            <InboxEmptyState inboxEmail={firstInboxEmail} />
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="text-sm text-white/70">Inga trådar matchar filtret</p>
            <Link
              href="/app/inbox"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-primary border border-primary/25 hover:border-primary/40 hover:bg-primary/[0.05] transition-colors"
            >
              Rensa filter →
            </Link>
          </div>
        )
      ) : (
        <InboxShell
          canGenerate={account.access.canGenerateAiDraft}
          dryRunEnabled={dryRunEnabled}
          slaByCaseType={slaByCaseType}
          initialNextCursor={initialNextCursor}
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
            triageFailed:  t.triageFailed ?? false,
            confidence:    confidenceByThread.get(t.id) ?? null,
          }))}
        />
      )}
    </div>
  );
}
