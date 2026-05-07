"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrganizationEditor({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = name.trim() !== initialName && name.trim().length > 0;

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/app/organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      setSavedAt(new Date());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5 space-y-4">
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          Workspace name
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={255}
          className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-primary/50 focus:outline-none"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Shown in the app header and on outgoing receipts.
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-white/5 pt-3">
        <div className="text-xs">
          {error && <span className="text-red-400">{error}</span>}
          {!error && savedAt && <span className="text-green-400">Saved {savedAt.toLocaleTimeString("sv-SE")}</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="px-4 py-1.5 rounded-lg bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
