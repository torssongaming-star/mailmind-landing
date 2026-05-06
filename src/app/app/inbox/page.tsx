/**
 * /app/inbox — list of email threads.
 *
 * Phase 2 minimum viable UI. Until inbox connectors land, threads are created
 * via the "New test thread" button which posts to /api/app/threads.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listThreads } from "@/lib/app/threads";
import { NewThreadButton } from "./NewThreadButton";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");

  const threads = await listThreads(account.organization.id, 100);

  return (
    <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Inbox</p>
          <h1 className="text-2xl font-bold text-white">Threads</h1>
          <p className="text-xs text-muted-foreground mt-1">{threads.length} thread{threads.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app" className="text-xs text-muted-foreground hover:text-white px-3 py-1.5 transition-colors">
            ← App home
          </Link>
          <NewThreadButton />
        </div>
      </header>

      {threads.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-10 text-center">
          <p className="text-white/70 text-sm mb-1">No threads yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Create a test thread to try the AI draft flow before connecting a real inbox.
          </p>
          <NewThreadButton />
        </div>
      ) : (
        <ul className="rounded-2xl border border-white/8 bg-[#050B1C]/60 backdrop-blur-sm divide-y divide-white/5 overflow-hidden">
          {threads.map(t => (
            <li key={t.id}>
              <Link
                href={`/app/thread/${t.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{t.subject ?? "(no subject)"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.fromName ? `${t.fromName} ` : ""}<span className="text-white/30">&lt;{t.fromEmail}&gt;</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <StatusPill s={t.status} />
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }) : "—"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function StatusPill({ s }: { s: string }) {
  const map: Record<string, string> = {
    open:      "bg-green-500/15 text-green-400 border-green-500/30",
    waiting:   "bg-amber-500/15 text-amber-400 border-amber-500/30",
    escalated: "bg-red-500/15 text-red-400 border-red-500/30",
    resolved:  "bg-white/10 text-muted-foreground border-white/15",
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${map[s] ?? map.resolved}`}>
      {s}
    </span>
  );
}
