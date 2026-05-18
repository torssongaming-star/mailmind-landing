"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { ForwardingGuide } from "./ForwardingGuide";
import { ConnectionTester } from "./ConnectionTester";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type InboxRow = {
  id: string;
  email: string;
  displayName: string | null;
  provider: string;
  status: string;
  forwardedFrom: string | null;
};

type View = "idle" | "picker" | "form";

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

  // Empty state → jump straight to picker so users choose type first
  const [view, setView] = useState<View>(initial.length === 0 ? "picker" : "idle");
  const [pending, setPending]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [slug, setSlug]                 = useState("");
  const [displayName, setDisplayName]   = useState("");
  const [forwardedFrom, setForwardedFrom] = useState("");
  const [copiedId, setCopiedId]         = useState<string | null>(null);
  const [testingIds, setTestingIds]     = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
      setView("idle");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (id: string) => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/inboxes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? t("common.error"));
      }
      router.refresh();
      setPendingDeleteId(null);
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

  const sv = locale === "sv";

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={async () => {
          if (pendingDeleteId) await handleDelete(pendingDeleteId);
        }}
        title={t("portal.inboxes.editor.disconnectConfirm")}
        body={locale === "sv"
          ? "Vi slutar ta emot nya mejl från denna inkorg. Befintliga trådar finns kvar."
          : "We'll stop receiving new mail from this inbox. Existing threads remain."}
        confirmLabel={t("portal.inboxes.editor.disconnect")}
        tone="danger"
        pending={pending}
      />

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* ── Inbox list ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {initial.map(inbox => (
          <div
            key={inbox.id}
            className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">{providerIcon(inbox.provider)}</span>
                  <p className="text-sm font-semibold text-white">{inbox.displayName ?? inbox.email}</p>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {providerLabel(inbox.provider, sv)} · {t(`portal.inboxes.status.${inbox.status.toLowerCase()}`)}
                  {inbox.forwardedFrom && (
                    <> · {t("portal.inboxes.labels.forwardedFrom").toLowerCase()}{" "}
                    <span className="text-white/70">{inbox.forwardedFrom}</span></>
                  )}
                </p>
              </div>
              <button
                onClick={() => setPendingDeleteId(inbox.id)}
                disabled={pending}
                className="text-xs text-red-400 hover:text-red-300 transition-colors shrink-0 focus-visible:outline-none focus-visible:underline disabled:opacity-50"
              >
                {t("portal.inboxes.editor.disconnect")}
              </button>
            </div>

            {/* Only forwarding inboxes show the mailmind address */}
            {inbox.provider === "mailmind" && (
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
            )}

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

            {inbox.provider === "mailmind" && (
              <ForwardingGuide mailmindAddress={inbox.email} />
            )}
          </div>
        ))}
      </div>

      {/* ── Connection type picker ───────────────────────────────────────── */}
      {view === "picker" && canAddMore && (
        <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">
              {sv ? "Hur vill du koppla din inkorg?" : "How do you want to connect your inbox?"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {sv
                ? "Välj direktintegration (OAuth) eller vidarebefordran om du inte kan ge oss tillgång."
                : "Choose direct integration (OAuth) or email forwarding if you prefer not to grant access."}
            </p>
          </div>

          <div className="grid gap-3">
            {/* Outlook / Microsoft 365 — recommended for Swedish B2B */}
            <Link
              href="/api/app/inboxes/outlook/auth"
              className="flex items-start gap-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 px-4 py-3.5 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:border-cyan-500/30 transition-colors">
                <OutlookLogo className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                  {sv ? "Koppla Outlook / Microsoft 365" : "Connect Outlook / Microsoft 365"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sv
                    ? "Direktintegration via Microsoft Graph API. Vi läser och skickar mejl i ditt namn."
                    : "Direct integration via Microsoft Graph API. We read and send mail on your behalf."}
                </p>
                <span className="inline-block mt-1.5 text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-full">
                  {sv ? "Rekommenderas" : "Recommended"}
                </span>
              </div>
              <span className="text-white/40 group-hover:text-white/70 text-sm self-center">→</span>
            </Link>

            {/* Gmail */}
            <Link
              href="/api/app/inboxes/gmail/auth"
              className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] px-4 py-3.5 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:border-white/20 transition-colors">
                <GmailLogo className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-white group-hover:text-white transition-colors">
                  {sv ? "Koppla Gmail / Google Workspace" : "Connect Gmail / Google Workspace"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sv
                    ? "Direktintegration via Gmail API. Vi läser och skickar mejl i ditt namn."
                    : "Direct integration via Gmail API. We read and send mail on your behalf."}
                </p>
              </div>
              <span className="text-white/40 group-hover:text-white/70 text-sm self-center">→</span>
            </Link>

            {/* Forwarding — advanced option */}
            <button
              onClick={() => setView("form")}
              className="flex items-start gap-4 rounded-xl border border-white/8 bg-white/[0.01] hover:bg-white/[0.03] px-4 py-3.5 transition-colors group text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:border-white/20 transition-colors">
                <span className="text-xl">📧</span>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-white/70 group-hover:text-white transition-colors">
                  {sv ? "Vidarebefordra e-post (avancerat)" : "Email forwarding (advanced)"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sv
                    ? "Vi skapar en unik Mailmind-adress. Du ställer in vidarebefordring i ditt egna mailsystem."
                    : "We create a unique Mailmind address. You configure forwarding in your own mail system."}
                </p>
              </div>
              <span className="text-white/40 group-hover:text-white/70 text-sm self-center">→</span>
            </button>
          </div>

          {initial.length > 0 && (
            <div className="pt-1 border-t border-white/5 flex justify-end">
              <button
                onClick={() => setView("idle")}
                className="text-xs text-muted-foreground hover:text-white transition-colors"
              >
                {sv ? "Avbryt" : "Cancel"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Forwarding form ──────────────────────────────────────────────── */}
      {view === "form" && canAddMore && (
        <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("picker")}
              className="text-xs text-muted-foreground hover:text-white transition-colors"
            >
              ← {sv ? "Tillbaka" : "Back"}
            </button>
            <h3 className="text-sm font-semibold text-white">{t("portal.inboxes.editor.connectTitle")}</h3>
          </div>

          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-200/80 leading-relaxed">
            <p className="font-semibold text-amber-200 mb-1">
              {sv ? "Hur vidarebefordran fungerar" : "How forwarding works"}
            </p>
            <p>
              {sv
                ? "Vi skapar en adress som t.ex. support@mail.mailmind.se. Du sätter sedan upp en vidarebefordringsregel i Gmail, Outlook eller ditt mailsystem så att mejl till din supportadress skickas hit. Mailmind tar emot dem och skapar AI-svarsutkast."
                : "We create an address like support@mail.mailmind.se. You then set up a forwarding rule in Gmail, Outlook or your mail system so that emails to your support address are sent here. Mailmind receives them and creates AI reply drafts."}
            </p>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {t("portal.inboxes.labels.displayName")}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder={sv ? "t.ex. Kundsupport" : "e.g. Customer support"}
              className="ix-input"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {sv ? "Välj en slug (del av adressen)" : "Choose a slug (part of the address)"}
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
              {t("portal.inboxes.labels.forwardedFrom")} ({t("portal.onboarding.optional")}, {sv ? "bara för din referens" : "just for your reference"})
            </label>
            <input
              type="email"
              value={forwardedFrom}
              onChange={e => setForwardedFrom(e.target.value)}
              placeholder="support@yourcompany.com"
              className="ix-input"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <button
              onClick={() => { setView("picker"); setSlug(""); setDisplayName(""); setForwardedFrom(""); }}
              disabled={pending}
              className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-white transition-colors"
            >
              {sv ? "Avbryt" : "Cancel"}
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

      {/* ── Add another button (has inboxes, can add more, not in picker) ── */}
      {view === "idle" && canAddMore && (
        <button
          onClick={() => setView("picker")}
          className="w-full rounded-2xl border border-dashed border-white/15 bg-white/[0.01] px-4 py-3 text-xs text-muted-foreground hover:text-white hover:border-white/30 transition-colors"
        >
          + {t("portal.inboxes.editor.connectAnother")}
        </button>
      )}

      {/* ── Limit reached ────────────────────────────────────────────────── */}
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function providerIcon(provider: string): React.ReactNode {
  switch (provider) {
    case "gmail":   return <GmailLogo className="w-5 h-5" />;
    case "outlook": return <OutlookLogo className="w-5 h-5" />;
    default:        return <span className="text-lg leading-none">📧</span>;
  }
}

function providerLabel(provider: string, sv: boolean): string {
  switch (provider) {
    case "gmail":   return "Gmail";
    case "outlook": return "Outlook / M365";
    default:        return sv ? "Vidarebefordran" : "Forwarding";
  }
}

function GmailLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 8.414l8.073-4.921c1.618-1.214 3.927-.059 3.927 1.964Z" fill="#EA4335"/>
      <path d="M12 16.64 5.455 11.73V3.493L12 8.414l6.545-4.921v8.236L12 16.64Z" fill="#EA4335"/>
      <path d="M12 8.414l6.545-4.921v8.236L12 16.64V8.414Z" fill="#FBBC04"/>
      <path d="M12 16.64v-8.226l6.545-4.921c.974-.73 2.383-.035 2.383 1.179l-9.2 6.911v5.057Z" fill="#34A853"/>
      <path d="M12 16.64v-5.057l-9.2-6.911C1.226 5.85 2.635 6.544 3.609 5.814L12 12.12v4.52Z" fill="#4285F4"/>
    </svg>
  );
}

function OutlookLogo({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0078D4" className={className}>
      <path d="M13.593 3.42l-9.453 1.62C3.513 5.148 3 5.72 3 6.353v11.127c0 .636.513 1.205 1.14 1.312l9.453 1.623V3.42zm2.08 1.488L20.44 6.84a1.325 1.325 0 0 1 .693 1.157v7.915c0 .54-.316 1-.692 1.155l-4.768 1.932V4.908z"/>
      <path fill="#fff" d="M11 12h-4V8h4v4z"/>
    </svg>
  );
}
