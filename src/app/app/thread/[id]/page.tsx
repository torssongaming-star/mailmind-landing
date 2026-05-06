/**
 * /app/thread/[id] — single thread view + AI draft generation.
 *
 * Shows the conversation, a "Generate AI draft" button, and any pending
 * drafts that need approval.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { getThread, listMessages, listDraftsForThread } from "@/lib/app/threads";
import { GenerateDraftButton } from "./GenerateDraftButton";
import { DraftActions } from "./DraftActions";

export const dynamic = "force-dynamic";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");

  const thread = await getThread(account.organization.id, id);
  if (!thread) notFound();

  const [messages, drafts] = await Promise.all([
    listMessages(id),
    listDraftsForThread(id),
  ]);

  const canGenerate = account.access.canGenerateAiDraft;
  const blockedReason = account.access.canGenerateAiDraft ? null : account.access.reason;

  return (
    <main className="max-w-3xl mx-auto p-6 md:p-10 space-y-6">
      <header className="space-y-2">
        <Link href="/app/inbox" className="text-xs text-muted-foreground hover:text-white transition-colors inline-block">
          ← Inbox
        </Link>
        <h1 className="text-xl font-bold text-white">{thread.subject ?? "(no subject)"}</h1>
        <p className="text-xs text-muted-foreground">
          From <span className="text-white/80">{thread.fromName ?? thread.fromEmail}</span>
          {thread.fromName && <span className="text-muted-foreground"> &lt;{thread.fromEmail}&gt;</span>}
          {" · "}
          <span className="uppercase">{thread.status}</span>
          {thread.caseTypeSlug && <> · <span>{thread.caseTypeSlug}</span></>}
          {" · "}
          <span>{thread.interactionCount} interaction{thread.interactionCount === 1 ? "" : "s"}</span>
        </p>
      </header>

      {/* Conversation */}
      <section className="space-y-3">
        {messages.map(m => (
          <div
            key={m.id}
            className={`rounded-2xl border p-4 ${
              m.role === "customer"
                ? "border-white/8 bg-[#050B1C]/60"
                : m.role === "assistant"
                  ? "border-primary/20 bg-primary/[0.04] ml-6"
                  : "border-cyan-500/20 bg-cyan-500/[0.04] ml-6"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {m.role}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(m.sentAt).toLocaleString("sv-SE")}
              </span>
            </div>
            <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{m.bodyText}</p>
          </div>
        ))}
      </section>

      {/* Action area */}
      <section className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">AI draft</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generate a draft reply. You&apos;ll review it before anything is sent.
            </p>
          </div>
          {canGenerate ? (
            <GenerateDraftButton threadId={thread.id} />
          ) : (
            <Link
              href="/dashboard/billing"
              className="text-xs text-amber-400 underline underline-offset-2"
            >
              {blockedReason === "no_subscription" ? "Choose a plan" : `Blocked: ${blockedReason}`}
            </Link>
          )}
        </div>
      </section>

      {/* Drafts */}
      {drafts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Drafts ({drafts.length})
          </h2>
          {drafts.map(d => (
            <div
              key={d.id}
              className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5 space-y-3"
            >
              <div className="flex items-center gap-2">
                <ActionBadge action={d.action} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {d.status}
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {new Date(d.generatedAt).toLocaleString("sv-SE")}
                </span>
              </div>

              {d.bodyText && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    {d.action === "summarize" ? "Customer reply" : "Question"}
                  </p>
                  <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">
                    {d.bodyText}
                  </p>
                </div>
              )}

              {d.action === "summarize" && d.metadata && (
                <div className="border-t border-white/5 pt-3 space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Internal summary
                  </p>
                  <p className="text-xs text-white/70 leading-relaxed">
                    {String((d.metadata as { summary?: string }).summary ?? "")}
                  </p>
                  <details className="text-xs">
                    <summary className="text-muted-foreground cursor-pointer">Collected info</summary>
                    <pre className="text-[10px] text-white/50 mt-2 bg-black/30 p-2 rounded font-mono overflow-x-auto">
                      {JSON.stringify((d.metadata as { collected_info?: unknown }).collected_info ?? {}, null, 2)}
                    </pre>
                  </details>
                </div>
              )}

              {d.action === "escalate" && (
                <p className="text-xs text-red-400">
                  {String((d.metadata as { reason?: string })?.reason ?? "Escalated")}
                </p>
              )}

              <DraftActions
                draftId={d.id}
                action={d.action}
                status={d.status}
                initialBody={d.bodyText}
              />

              <p className="text-[10px] text-muted-foreground border-t border-white/5 pt-2">
                {d.aiModel}
                {d.status === "sent" && d.sentAt && <> · sent {new Date(d.sentAt).toLocaleString("sv-SE")}</>}
                {d.status === "rejected" && <> · rejected</>}
              </p>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

function ActionBadge({ action }: { action: "ask" | "summarize" | "escalate" }) {
  const map = {
    ask:       { label: "Ask",       cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    summarize: { label: "Summarize", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
    escalate:  { label: "Escalate",  cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  };
  const v = map[action];
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${v.cls}`}>
      {v.label}
    </span>
  );
}
