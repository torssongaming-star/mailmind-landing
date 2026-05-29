"use client";

/**
 * RoofSurfaceForm
 *
 * Manages a list of roof surfaces for the Solar ROI engine.
 * Each surface has: area (m²), tilt (°), azimuth (°), shading (0–1), label.
 * Calls onSubmit with the validated surfaces array.
 *
 * Validation: uses the Zod schema from the engine types for per-row feedback.
 * Dependencies: only engine types + Radix-free Tailwind UI — no new packages.
 */

import { useState } from "react";
import type { RoofSurfaceInput } from "@/lib/solar/engine/types";
import { RoofSurfaceInputSchema } from "@/lib/solar/engine/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type SurfaceRow = RoofSurfaceInput & { _key: string };

type Props = {
  initialSurfaces?: RoofSurfaceInput[];
  onSubmit:         (surfaces: RoofSurfaceInput[]) => void;
  loading?:         boolean;
};

// ── Default ───────────────────────────────────────────────────────────────────

const DEFAULT_SURFACE: Omit<SurfaceRow, "_key"> = {
  label:   "Söderfasad",
  area:    30,
  tilt:    35,
  azimuth: 180,
  shading: 0,
};

function makeKey() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LABEL_CLASS = "block text-[11px] font-medium text-white/50 mb-1";
const INPUT_CLASS =
  "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-colors";

// ── Component ─────────────────────────────────────────────────────────────────

export function RoofSurfaceForm({ initialSurfaces, onSubmit, loading }: Props) {
  const [surfaces, setSurfaces] = useState<SurfaceRow[]>(() => {
    const initial = initialSurfaces?.length ? initialSurfaces : [DEFAULT_SURFACE];
    return initial.map((s) => ({ ...s, _key: makeKey() }));
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Row mutations ─────────────────────────────────────────────────────────

  function updateRow(key: string, field: keyof RoofSurfaceInput, raw: string) {
    setSurfaces((prev) =>
      prev.map((s) => {
        if (s._key !== key) return s;
        if (field === "label") return { ...s, label: raw };
        const num = parseFloat(raw);
        return { ...s, [field]: isNaN(num) ? 0 : num };
      }),
    );
    // Clear error for field on change
    setErrors((e) => {
      const next = { ...e };
      delete next[`${key}.${field}`];
      return next;
    });
  }

  function addRow() {
    setSurfaces((prev) => [
      ...prev,
      { ...DEFAULT_SURFACE, label: `Yta ${prev.length + 1}`, _key: makeKey() },
    ]);
  }

  function removeRow(key: string) {
    setSurfaces((prev) => prev.filter((s) => s._key !== key));
  }

  // ── Validate + submit ─────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    const validated: RoofSurfaceInput[] = [];

    for (const row of surfaces) {
      const { _key, ...data } = row;
      const result = RoofSurfaceInputSchema.safeParse(data);
      if (!result.success) {
        for (const issue of result.error.issues) {
          newErrors[`${_key}.${String(issue.path[0])}`] = issue.message;
        }
      } else {
        validated.push(result.data);
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(validated);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {surfaces.map((row, idx) => (
        <div
          key={row._key}
          className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"
        >
          {/* Row header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-white/60">
              Yta {idx + 1}
            </span>
            {surfaces.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(row._key)}
                className="text-[11px] text-red-400/70 hover:text-red-400 transition-colors"
              >
                Ta bort
              </button>
            )}
          </div>

          {/* Field grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Label */}
            <div className="col-span-2 sm:col-span-1">
              <label className={LABEL_CLASS}>Etikett</label>
              <input
                type="text"
                className={INPUT_CLASS}
                value={row.label ?? ""}
                onChange={(e) => updateRow(row._key, "label", e.target.value)}
                placeholder="t.ex. Södertak"
              />
            </div>

            {/* Area */}
            <div>
              <label className={LABEL_CLASS}>Yta (m²)</label>
              <input
                type="number"
                min={1}
                step={0.5}
                className={cn(INPUT_CLASS, errors[`${row._key}.area`] && "border-red-500/50")}
                value={row.area}
                onChange={(e) => updateRow(row._key, "area", e.target.value)}
              />
              {errors[`${row._key}.area`] && (
                <p className="text-[11px] text-red-400 mt-0.5">{errors[`${row._key}.area`]}</p>
              )}
            </div>

            {/* Tilt */}
            <div>
              <label className={LABEL_CLASS}>Lutning (°)</label>
              <input
                type="number"
                min={0}
                max={90}
                step={1}
                className={cn(INPUT_CLASS, errors[`${row._key}.tilt`] && "border-red-500/50")}
                value={row.tilt}
                onChange={(e) => updateRow(row._key, "tilt", e.target.value)}
              />
              {errors[`${row._key}.tilt`] && (
                <p className="text-[11px] text-red-400 mt-0.5">{errors[`${row._key}.tilt`]}</p>
              )}
            </div>

            {/* Azimuth */}
            <div>
              <label className={LABEL_CLASS}>Azimut (° — 180=S)</label>
              <input
                type="number"
                min={0}
                max={360}
                step={1}
                className={cn(INPUT_CLASS, errors[`${row._key}.azimuth`] && "border-red-500/50")}
                value={row.azimuth}
                onChange={(e) => updateRow(row._key, "azimuth", e.target.value)}
              />
              {errors[`${row._key}.azimuth`] && (
                <p className="text-[11px] text-red-400 mt-0.5">{errors[`${row._key}.azimuth`]}</p>
              )}
            </div>

            {/* Shading */}
            <div>
              <label className={LABEL_CLASS}>Skuggning (0–1)</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                className={cn(INPUT_CLASS, errors[`${row._key}.shading`] && "border-red-500/50")}
                value={row.shading}
                onChange={(e) => updateRow(row._key, "shading", e.target.value)}
              />
              {errors[`${row._key}.shading`] && (
                <p className="text-[11px] text-red-400 mt-0.5">{errors[`${row._key}.shading`]}</p>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={addRow}
          className="text-xs text-primary/70 hover:text-primary transition-colors font-medium"
        >
          + Lägg till yta
        </button>

        <div className="ml-auto">
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? "Beräknar…" : "Kör beräkning"}
          </Button>
        </div>
      </div>
    </form>
  );
}
