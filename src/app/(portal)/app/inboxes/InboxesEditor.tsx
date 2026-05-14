"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { ForwardingGuide } from "./ForwardingGuide";
import { ConnectionTester } from "./ConnectionTester";

type InboxRow = {
  id: string;
  email: string;
  displayName: string | null;
  provider: string;
  status: string;
  forwardedFrom: string | null;
};

export function InboxesEditor({
  initial,
  canAddMore,
  limit,
}: {
  initial: InboxRow[];
  canAddMore: boolean;
  limit: number;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [showForm, setShowForm] = useState(initial.length === 0);
  const [pending, setPending]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [slug, setSlug]                 = useState("");
  const [displayName, setDisplayName]   = useState("");
  const [forwardedFrom, setForwardedFrom] = useState("");
  const [copiedId, setCopiedId]         = useState<string | null>(null);
  /** IDs of inboxes the user just created in this session — we show the
   *  ConnectionTester on these until the user dismisses it. Keyed by id so
   *  it survives router.refresh(). */
  const [testingIds, setTestingIds]     = useState<Set<string>>(new Set());

  const handleCreate = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/app/inboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug.toLowerCase(),
          displayName: displayName.trim(),
          forwardedFrom: forwardedFrom.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("common.error"));
      if (data.inbox?.id) {
        setTestingIds(prev => new Set(prev).add(data.inbox.id));
      }
      setSlug(""); setDisplayName(""); setForwardedFrom("");
      setShowForm(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("portal.inboxes.editor.disconnectConfirm"))) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/inboxes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? t("common.error"));
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setPending(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Inbox list */}
      <div className="space-y-2">
        {initial.map(inbox => (
          <div
            key={inbox.id}
            className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{inbox.displayName ?? inbox.email}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {inbox.provider} · {t(`portal.inboxes.status.${inbox.status.toLowerCase()}` as any)}
                  {inbox.forwardedFrom && <> · {t("portal.inboxes.labels.forwardedFrom").toLowerCase()} <span className="text-white/70">{inbox.forwardedFrom}</span></>}
                </p>
              </div>
              <button
                onClick={() => handleDelete(inbox.id)}
                disabled={pending}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                {t("portal.inboxes.editor.disconnect")}
              </button>
            </div>

            <div className="rounded-lg bg-black/30 px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                  {t("portal.inboxes.editor.forwardTo")}
                </p>
                <p className="text-sm font-mono text-cyan-300 truncate">{inbox.email}</p>
              </div>
              <button
                onClick={() => copyToClipboard(inbox.email, inbox.id)}
                className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white transition-colors shrink-0"
              >
                {copiedId === inbox.id ? t("portal.inboxes.editor.copied") : t("portal.inboxes.editor.copy")}
              </button>
            </div>

            {/* Live connection tester — only on inboxes created this session */}
            {testingIds.has(inbox.id) && (
              <ConnectionTester
                inboxId={inbox.id}
                email={inbox.email}
                onDismiss={() => setTestingIds(prev => {
                  const next = new Set(prev);
                  next.delete(inbox.id);
                  return next;
                })}
              />
            )}

            {/* Forwarding setup guide — expandable */}
            <ForwardingGuide mailmindAddress={inbox.email} />
          </div>
        ))}
      </div>

      {/* New inbox form */}
      {showForm && canAddMore && (
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">{t("portal.inboxes.editor.connectTitle")}</h3>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {t("portal.inboxes.labels.displayName")}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Customer support"
              className="ix-input"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {locale === "sv" ? "Välj en slug" : "Choose a slug"}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="support"
                className="ix-input flex-1"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">@mail.mailmind.se</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {t("portal.inboxes.editor.slugHint")}
            </p>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {t("portal.inboxes.labels.forwardedFrom")} ({t("portal.onboarding.optional")}, {locale === "sv" ? "bara för din referens" : "just for your reference"})
            </label>
            <input
              type="email"
              value={forwardedFrom}
              onChange={e => setForwardedFrom(e.target.value)}
              placeholder="support@yourcompany.com"
              className="ix-input"
            />
          </div>

          <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/20 px-3 py-2.5 text-xs text-cyan-200/80 leading-relaxed">
            <p className="font-semibold text-cyan-200 mb-1">{t("portal.inboxes.editor.afterCreateTitle")}</p>
            <p>{t("portal.inboxes.editor.afterCreateDesc", { address: "@mail.mailmind.se" })}</p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <button
              onClick={() => { setShowForm(false); setSlug(""); setDisplayName(""); setForwardedFrom(""); }}
              disabled={pending}
              className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-white transition-colors"
            >
              {t("common.cancel" as any) || (locale === "sv" ? "Avbryt" : "Cancel")}
            </button>
            <button
              onClick={handleCreate}
              disabled={pending || !slug.trim() || !displayName.trim()}
              className="px-4 py-1.5 rounded-lg bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40"
            >
              {pending ? t("portal.inboxes.editor.creating") : t("portal.inboxes.editor.create")}
            </button>
          </div>
        </div>
      )}

      {!showForm && canAddMore && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-xs text-muted-foreground hover:text-white hover:border-white/30 transition-colors"
        >
          {t("portal.inboxes.editor.connectAnother")}
        </button>
      )}

      {!canAddMore && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
          {t("portal.inboxes.editor.limitReached", { limit: limit.toString() })}{" "}
          <a href="/dashboard/billing" className="underline">{t("portal.inboxes.editor.upgrade")}</a>
        </div>
      )}

      <style>{`
        .ix-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          color: white;
          font-size: 13px;
          border-radius: 8px;
          padding: 8px 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          outline: none;
        }
        .ix-input:focus { border-color: rgba(99, 102, 241, 0.5); }
      `}</style>
    </div>
  );
}
