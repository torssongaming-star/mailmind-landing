"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Webhook = {
  id: string;
  url: string;
  caseTypeSlug: string;
  secret: string | null;
  isActive: boolean;
  lastStatus: string | null;
  lastFiredAt: Date | string | null;
};

type CaseTypeMeta = { slug: string; label: string };

export function WebhooksEditor({
  initial,
  caseTypes,
}: {
  initial: Webhook[];
  caseTypes: CaseTypeMeta[];
}) {
  const router = useRouter();
  const [webhooks, setWebhooks] = useState<Webhook[]>(initial);
  const [url, setUrl] = useState("");
  const [caseTypeSlug, setCaseTypeSlug] = useState("*");
  const [secret, setSecret] = useState("");
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!url.trim()) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/app/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          caseTypeSlug,
          secret: secret.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Kunde inte skapa webhook");
      setWebhooks(prev => [...prev, data.webhook]);
      setUrl("");
      setSecret("");
      setCaseTypeSlug("*");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/app/webhooks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Kunde inte ta bort");
      }
      setWebhooks(prev => prev.filter(w => w.id !== id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Add new webhook */}
      <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-4 space-y-3">
        <p className="text-xs font-semibold text-white/70">Lägg till webhook</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/..."
              className="wh-input"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Ärendetyp</label>
            <select
              value={caseTypeSlug}
              onChange={e => setCaseTypeSlug(e.target.value)}
              className="wh-input"
            >
              <option value="*">Alla</option>
              {caseTypes.map(ct => (
                <option key={ct.slug} value={ct.slug}>{ct.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Hemlig nyckel (valfritt — skickas som X-Mailmind-Secret)
          </label>
          <input
            type="text"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder="my-secret-token"
            className="wh-input"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            disabled={pending || !url.trim()}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-[#030614] hover:bg-cyan-300 transition-colors disabled:opacity-40"
          >
            {pending ? "Lägger till…" : "Lägg till"}
          </button>
        </div>
      </div>

      {/* Existing webhooks */}
      {webhooks.length === 0 ? (
        <p className="text-xs text-muted-foreground italic px-1 py-3">
          Inga webhooks ännu.
        </p>
      ) : (
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 overflow-hidden">
          <ul className="divide-y divide-white/5">
            {webhooks.map(w => (
              <li key={w.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm text-white font-mono truncate">{w.url}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.caseTypeSlug === "*"
                      ? "Alla ärendetyper"
                      : caseTypes.find(ct => ct.slug === w.caseTypeSlug)?.label ?? w.caseTypeSlug}
                    {w.secret && " · Nyckel konfigurerad"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {w.lastStatus && (
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      w.lastStatus === "ok"
                        ? "bg-green-500/15 text-green-400 border-green-500/30"
                        : "bg-red-500/15 text-red-400 border-red-500/30"
                    }`}>
                      {w.lastStatus}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(w.id)}
                    disabled={deletingId === w.id}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
                  >
                    {deletingId === w.id ? "Tar bort…" : "Ta bort"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <style>{`
        .wh-input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          color: white;
          font-size: 13px;
          border-radius: 8px;
          padding: 8px 12px;
          border: 1px solid rgba(255,255,255,0.1);
          outline: none;
        }
        .wh-input:focus { border-color: rgba(99,102,241,0.5); }
        .wh-input option { background: #050B1C; }
      `}</style>
    </div>
  );
}
