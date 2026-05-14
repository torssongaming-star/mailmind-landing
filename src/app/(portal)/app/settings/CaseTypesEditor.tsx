"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CaseType } from "@/lib/db/schema";

const SLUG_PATTERN = /^[a-z0-9_]{1,100}$/;

function slugify(s: string) {
  return s.toLowerCase()
    .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
}

type Row = {
  id?: string;
  slug: string;
  label: string;
  requiredFields: string[];
  routeToEmail: string | null;
  isDefault: boolean;
  slaHours: number | null;
  /** local-only state */
  _isNew?: boolean;
  _isDirty?: boolean;
};

export function CaseTypesEditor({ initial }: { initial: CaseType[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(
    initial.map(c => ({
      id:             c.id,
      slug:           c.slug,
      label:          c.label,
      requiredFields: (c.requiredFields ?? []) as string[],
      routeToEmail:   c.routeToEmail,
      isDefault:      c.isDefault,
      slaHours:       c.slaHours ?? null,
    }))
  );
  const [addingNew, setAddingNew] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const updateRow = (idx: number, patch: Partial<Row>) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch, _isDirty: true } : r));
  };

  const handleSave = async (idx: number) => {
    const row = rows[idx];
    setError(null);
    setPending(row.id ?? "new");

    try {
      if (row._isNew) {
        if (!SLUG_PATTERN.test(row.slug)) throw new Error("Slug får bara innehålla gemener, siffror och understreck");
        if (!row.label.trim()) throw new Error("Etikett krävs");

        const res = await fetch("/api/app/case-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug:           row.slug,
            label:          row.label,
            requiredFields: row.requiredFields,
            routeToEmail:   row.routeToEmail || null,
            isDefault:      row.isDefault,
            slaHours:       row.slaHours ?? null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Kunde inte skapa ärendetyp");
        // Replace the row with the saved one
        setRows(prev => prev.map((r, i) => i === idx ? {
          ...r, id: data.caseType.id, _isNew: false, _isDirty: false,
        } : r));
      } else if (row.id) {
        const res = await fetch(`/api/app/case-types/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label:          row.label,
            requiredFields: row.requiredFields,
            routeToEmail:   row.routeToEmail || null,
            isDefault:      row.isDefault,
            slaHours:       row.slaHours ?? null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Kunde inte uppdatera ärendetyp");
        updateRow(idx, { _isDirty: false });
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(null);
    }
  };

  const handleDelete = async (idx: number) => {
    const row = rows[idx];
    if (!row.id) {
      // Just remove unsaved local row
      setRows(prev => prev.filter((_, i) => i !== idx));
      setAddingNew(false);
      return;
    }
    if (!confirm(`Ta bort "${row.label}"?`)) return;
    setError(null);
    setPending(row.id);
    try {
      const res = await fetch(`/api/app/case-types/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Kunde inte ta bort ärendetyp");
      }
      setRows(prev => prev.filter((_, i) => i !== idx));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(null);
    }
  };

  const addNew = () => {
    setRows(prev => [...prev, {
      slug: "", label: "", requiredFields: [], routeToEmail: "",
      isDefault: false, slaHours: null, _isNew: true, _isDirty: true,
    }]);
    setAddingNew(true);
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-1 py-3">
            Inga ärendetyper än. Klicka "+ Lägg till ärendetyp" nedan för att skapa den första.
          </p>
        )}

        {rows.map((row, idx) => (
          <div
            key={row.id ?? `new-${idx}`}
            className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-4 space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Slug (internt)</label>
                <input
                  type="text"
                  value={row.slug}
                  disabled={!row._isNew}
                  onChange={e => updateRow(idx, { slug: slugify(e.target.value) })}
                  placeholder="offertforfragan"
                  className="ct-input"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Etikett</label>
                <input
                  type="text"
                  value={row.label}
                  onChange={e => updateRow(idx, {
                    label: e.target.value,
                    slug: row._isNew && !row.slug ? slugify(e.target.value) : row.slug,
                  })}
                  placeholder="Offertförfrågan"
                  className="ct-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Obligatoriska fält (kommaseparerade)
              </label>
              <input
                type="text"
                value={row.requiredFields.join(", ")}
                onChange={e => updateRow(idx, {
                  requiredFields: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                })}
                placeholder="adress, arbetstyp, onskat_startdatum"
                className="ct-input"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                AI:n ber kunden om dessa uppgifter innan ärendet dirigeras vidare.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Skicka färdiga ärenden till (valfritt)</label>
                <input
                  type="email"
                  value={row.routeToEmail ?? ""}
                  onChange={e => updateRow(idx, { routeToEmail: e.target.value })}
                  placeholder="offert@dittforetag.se"
                  className="ct-input"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">SLA (timmar, valfritt)</label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={row.slaHours ?? ""}
                  onChange={e => updateRow(idx, { slaHours: e.target.value ? parseInt(e.target.value, 10) : null })}
                  placeholder="48"
                  className="ct-input"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={row.isDefault}
                    onChange={e => updateRow(idx, { isDefault: e.target.checked })}
                    className="rounded"
                  />
                  Standardfallback (används när AI:n inte kan klassificera)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                onClick={() => handleDelete(idx)}
                disabled={pending === (row.id ?? "new")}
                className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Ta bort
              </button>
              <button
                onClick={() => handleSave(idx)}
                disabled={pending === (row.id ?? "new") || !row._isDirty}
                className="px-3 py-1.5 rounded-lg bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40"
              >
                {pending === (row.id ?? "new") ? "Sparar…" : (row._isNew ? "Skapa" : (row._isDirty ? "Spara" : "Sparat"))}
              </button>
            </div>
          </div>
        ))}
      </div>

      {!addingNew && (
        <button
          onClick={addNew}
          className="w-full rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-xs text-muted-foreground hover:text-white hover:border-white/30 transition-colors"
        >
          + Lägg till ärendetyp
        </button>
      )}

      <style>{`
        .ct-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          color: white;
          font-size: 13px;
          border-radius: 8px;
          padding: 8px 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          outline: none;
        }
        .ct-input:focus { border-color: rgba(99, 102, 241, 0.5); }
        .ct-input:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
