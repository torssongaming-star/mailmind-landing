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
import { getThread, listMessages, listDraftsForThread, listThreadsByEmail } from "@/lib/app/threads";
import { listNotes } from "@/lib/app/notes";
import { GenerateDraftButton } from "./GenerateDraftButton";
import { DraftActions } from "./DraftActions";
import { InternalNotes } from "./InternalNotes";
import { SnoozeButton } from "./SnoozeButton";
import { CustomerHistory } from "./CustomerHistory";
import { TagEditor } from "./TagEditor";
import { BlockSenderButton } from "./BlockSenderButton";
import { getTranslations } from "@/lib/i18n";
import { getUserLocale } from "@/lib/i18n/get-locale";

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

  const locale = await getUserLocale();
  const t = await getTranslations(locale);

  const [messages, drafts, notes, priorThreads] = await Promise.all([
    listMessages(id),
    listDraftsForThread(id),
    listNotes(account.organization.id, id),
    listThreadsByEmail(account.organization.id, thread.fromEmail, id),
  ]);

  const canGenerate = account.access.canGenerateAiDraft;
  const blockedReason = account.access.canGenerateAiDraft ? null : account.access.reason;

  return (
    <main className="max-w-3xl mx-auto p-6 md:p-10 space-y-6">
      <header className="space-y-2">
        <Link href="/app/inbox" className="text-xs text-muted-foreground hover:text-white transition-colors inline-block">
          ← {t("nav.inbox")}
        </Link>
        <h1 className="text-xl font-bold text-white">{thread.subject ?? t("inbox.noSubject")}</h1>
        <p className="text-xs text-muted-foreground">
          {locale === "sv" ? "Från" : "From"} <span className="text-white/80">{thread.fromName ?? thread.fromEmail}</span>
          {thread.fromName && <span className="text-muted-foreground"> &lt;{thread.fromEmail}&gt;</span>}
          {" · "}
          <span className="uppercase">{thread.status}</span>
          {thread.caseTypeSlug && <> · <span>{thread.caseTypeSlug}</span></>}
          {" · "}
          <span>{thread.interactionCount} {thread.interactionCount === 1 ? t("inbox.thread.status.interaction") : t("inbox.thread.status.interactions")}</span>
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <SnoozeButton
            threadId={thread.id}
            snoozedUntil={thread.snoozedUntil ?? null}
          />
          <BlockSenderButton fromEmail={thread.fromEmail} />
        </div>
        <TagEditor
          threadId={thread.id}
          initialTags={thread.tags ?? []}
        />
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
                {m.role === "customer" ? t("inbox.thread.roles.customer") : m.role === "assistant" ? t("inbox.thread.roles.ai") : t("inbox.thread.roles.agent")}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(m.sentAt).toLocaleString(locale === "sv" ? "sv-SE" : "en-IE")}
              </span>
            </div>
            <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{m.bodyText}</p>
          </div>
        ))}
      </section>

      {/* Internal notes (agent-only) */}
      <InternalNotes
        threadId={thread.id}
        initial={notes.map(n => ({
          id:          n.id,
          bodyText:    n.bodyText,
          authorEmail: n.authorEmail,
          createdAt:   n.createdAt,
        }))}
      />

      {/* Action area */}
      <section className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">{t("inbox.thread.draft")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("inbox.thread.status.canGenerate")}
            </p>
          </div>
          {canGenerate ? (
            <GenerateDraftButton threadId={thread.id} />
          ) : (
            <Link
              href="/dashboard/billing"
              className="text-xs text-amber-400 underline underline-offset-2"
            >
              {blockedReason === "no_subscription" ? t("inbox.thread.status.choosePlan") : t("inbox.thread.status.blocked", { reason: blockedReason ?? "" })}
            </Link>
          )}
        </div>
      </section>

      {/* Customer history */}
      <CustomerHistory
        fromEmail={thread.fromEmail}
        threads={priorThreads}
      />

      {/* Drafts */}
      {drafts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {t("inbox.thread.status.drafts")} ({drafts.length})
          </h2>
          {drafts.map(d => (
            <div
              key={d.id}
              className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5 space-y-3"
            >
              <div className="flex items-center gap-2">
                <ActionBadge action={d.action} t={t} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {d.status}
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {new Date(d.generatedAt).toLocaleString(locale === "sv" ? "sv-SE" : "en-IE")}
                </span>
              </div>

              {d.bodyText && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    {d.action === "summarize" ? t("inbox.thread.status.customerReply") : t("inbox.thread.status.question")}
                  </p>
                  <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">
                    {d.bodyText}
                  </p>
                </div>
              )}

              {d.action === "summarize" && d.metadata && (
                <div className="border-t border-white/5 pt-3 space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {t("inbox.thread.status.summary")}
                  </p>
                  <p className="text-xs text-white/70 leading-relaxed">
                    {String((d.metadata as { summary?: string }).summary ?? "")}
                  </p>
                  <details className="text-xs">
                    <summary className="text-muted-foreground cursor-pointer">{locale === "sv" ? "Insamlad information" : "Collected info"}</summary>
                    <pre className="text-[10px] text-white/50 mt-2 bg-black/30 p-2 rounded font-mono overflow-x-auto">
                      {JSON.stringify((d.metadata as { collected_info?: unknown }).collected_info ?? {}, null, 2)}
                    </pre>
                  </details>
                </div>
              )}

              {d.action === "escalate" && (
                <p className="text-xs text-red-400">
                  {String((d.metadata as { reason?: string })?.reason ?? t("inbox.thread.actions.escalate"))}
                </p>
              )}

              <DraftActions
                draftId={d.id}
                action={d.action}
                status={d.status}
                initialBody={d.bodyText}
                templateVars={{
                  customer_name: thread.fromName ?? "",
                  from_email:    thread.fromEmail,
                  case_type:     thread.caseTypeSlug ?? "",
                  ...(Object.fromEntries(
                    Object.entries(thread.collectedInfo ?? {}).map(([k, v]) => [k, String(v)])
                  )),
                }}
              />

              <p className="text-[10px] text-muted-foreground border-t border-white/5 pt-2">
                {d.aiModel}
                {d.status === "sent" && d.sentAt && <> · {t("inbox.thread.status.sent", { time: new Date(d.sentAt).toLocaleString(locale === "sv" ? "sv-SE" : "en-IE") })}</>}
                {d.status === "rejected" && <> · {t("inbox.thread.status.rejected")}</>}
              </p>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

function ActionBadge({ action, t }: { action: "ask" | "summarize" | "escalate"; t: any }) {
  const map = {
    ask:       { label: t("inbox.thread.actions.ask"),       cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    summarize: { label: t("inbox.thread.actions.summarize"), cls: "bg-green-500/15 text-green-400 border-green-500/30" },
    escalate:  { label: t("inbox.thread.actions.escalate"),  cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  };
  const v = map[action];
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${v.cls}`}>
      {v.label}
    </span>
  );
}
