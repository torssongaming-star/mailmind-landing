"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      if (data.inbox?.id) {
        setTestingIds(prev => new Set(prev).add(data.inbox.id));
      }
      setSlug(""); setDisplayName(""); setForwardedFrom("");
      setShowForm(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Disconnect this inbox? Existing threads will be deleted.")) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/inboxes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Delete failed");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
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
                  {inbox.provider} · {inbox.status}
                  {inbox.forwardedFrom && <> · forwards from <span className="text-white/70">{inbox.forwardedFrom}</span></>}
                </p>
              </div>
              <button
                onClick={() => handleDelete(inbox.id)}
                disabled={pending}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Disconnect
              </button>
            </div>

            <div className="rounded-lg bg-black/30 px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                  Forward email to
                </p>
                <p className="text-sm font-mono text-cyan-300 truncate">{inbox.email}</p>
              </div>
              <button
                onClick={() => copyToClipboard(inbox.email, inbox.id)}
                className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white transition-colors shrink-0"
              >
                {copiedId === inbox.id ? "Copied!" : "Copy"}
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
          <h3 className="text-sm font-semibold text-white">Connect an inbox</h3>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Display name
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
              Choose a slug
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
              We&apos;ll add a random suffix if your choice is taken.
            </p>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Forwards from (optional, just for your reference)
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
            <p className="font-semibold text-cyan-200 mb-1">After creating:</p>
            <p>Set up a forwarding rule in your email client (Gmail, Outlook, etc.) to forward incoming mail to your new <code className="text-cyan-300">@mail.mailmind.se</code> address. Mailmind will receive each message and queue an AI draft for your review.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <button
              onClick={() => { setShowForm(false); setSlug(""); setDisplayName(""); setForwardedFrom(""); }}
              disabled={pending}
              className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={pending || !slug.trim() || !displayName.trim()}
              className="px-4 py-1.5 rounded-lg bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40"
            >
              {pending ? "Creating…" : "Create inbox"}
            </button>
          </div>
        </div>
      )}

      {!showForm && canAddMore && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-xs text-muted-foreground hover:text-white hover:border-white/30 transition-colors"
        >
          + Connect another inbox
        </button>
      )}

      {!canAddMore && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
          You&apos;ve reached the {limit}-inbox limit for your current plan.{" "}
          <a href="/dashboard/billing" className="underline">Upgrade →</a>
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
