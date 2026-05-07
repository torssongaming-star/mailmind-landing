"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReplyTemplate } from "@/lib/db/schema";

const SLUG_PATTERN = /^[a-z0-9_-]{1,100}$/;

function slugify(s: string) {
  return s.toLowerCase()
    .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

type Row = {
  id?: string;
  title: string;
  slug: string;
  bodyText: string;
  useCount?: number;
  _isNew?: boolean;
  _isDirty?: boolean;
};

export function TemplatesEditor({ initial }: { initial: ReplyTemplate[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(
    initial.map(t => ({
      id:        t.id,
      title:     t.title,
      slug:      t.slug ?? "",
      bodyText:  t.bodyText,
      useCount:  t.useCount,
    }))
  );
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (idx: number, patch: Partial<Row>) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch, _isDirty: true } : r));

  const addNew = () => setRows(prev => [
    ...prev,
    { title: "", slug: "", bodyText: "", _isNew: true, _isDirty: true },
  ]);

  const handleSave = async (idx: number) => {
    const row = rows[idx];
    if (!row.title.trim() || !row.bodyText.trim()) {
      setError("Title and body are required");
      return;
    }
    if (row.slug && !SLUG_PATTERN.test(row.slug)) {
      setError("Slug must be lowercase letters, digits, hyphens or underscore");
      return;
    }

    setError(null);
    setPending(row.id ?? "new");
    try {
      if (row._isNew) {
        const res = await fetch("/api/app/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:    row.title.trim(),
            slug:     row.slug || undefined,
            bodyText: row.bodyText.trim(),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Create failed");
        setRows(prev => prev.map((r, i) => i === idx ? {
          ...r, id: data.template.id, _isNew: false, _isDirty: false,
        } : r));
      } else if (row.id) {
        const res = await fetch(`/api/app/templates/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:    row.title.trim(),
            slug:     row.slug || null,
            bodyText: row.bodyText.trim(),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Update failed");
        update(idx, { _isDirty: false });
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setPending(null);
    }
  };

  const handleDelete = async (idx: number) => {
    const row = rows[idx];
    if (!row.id) {
      setRows(prev => prev.filter((_, i) => i !== idx));
      return;
    }
    if (!confirm(`Delete template "${row.title}"?`)) return;

    setError(null);
    setPending(row.id);
    try {
      const res = await fetch(`/api/app/templates/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Delete failed");
      }
      setRows(prev => prev.filter((_, i) => i !== idx));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground italic px-1 py-3">
          No templates yet. Click &quot;Add template&quot; below to save your first canned response.
        </p>
      )}

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div
            key={row.id ?? `new-${idx}`}
            className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-4 space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Title</label>
                <input
                  type="text"
                  value={row.title}
                  onChange={e => update(idx, {
                    title: e.target.value,
                    slug: row._isNew && !row.slug ? slugify(e.target.value) : row.slug,
                  })}
                  placeholder="Quote thanks"
                  className="tpl-input"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Slug (optional)
                </label>
                <input
                  type="text"
                  value={row.slug}
                  onChange={e => update(idx, { slug: slugify(e.target.value) })}
                  placeholder="quote-thanks"
                  className="tpl-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Body</label>
              <textarea
                value={row.bodyText}
                onChange={e => update(idx, { bodyText: e.target.value })}
                rows={4}
                placeholder="Tack för din offertförfrågan! Vi återkommer med ett pris inom 2 arbetsdagar..."
                className="tpl-input resize-none"
              />
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-3">
              <span className="text-[10px] text-muted-foreground">
                {row.useCount != null && row.useCount > 0 && `Used ${row.useCount} time${row.useCount === 1 ? "" : "s"}`}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete(idx)}
                  disabled={pending === (row.id ?? "new")}
                  className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => handleSave(idx)}
                  disabled={pending === (row.id ?? "new") || !row._isDirty}
                  className="px-3 py-1.5 rounded-lg bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40"
                >
                  {pending === (row.id ?? "new") ? "Saving…" : (row._isNew ? "Create" : (row._isDirty ? "Save" : "Saved"))}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addNew}
        className="w-full rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-xs text-muted-foreground hover:text-white hover:border-white/30 transition-colors"
      >
        + Add template
      </button>

      <style>{`
        .tpl-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          color: white;
          font-size: 13px;
          border-radius: 8px;
          padding: 8px 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          outline: none;
        }
        .tpl-input:focus { border-color: rgba(99, 102, 241, 0.5); }
      `}</style>
    </div>
  );
}
