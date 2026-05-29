"use client";

/**
 * KbManager — knowledge-base management island for the Solar workspace.
 *
 * Lists KB entries, supports create / edit / delete / visibility-promotion
 * via the /api/quoting/kb endpoints. Visibility is the security-critical
 * axis: internal_only entries never reach customer-facing output, so the
 * UI makes the audience of each entry unmistakable.
 *
 * Mutations require owner/admin role — the server enforces this; the UI
 * hides write controls for members (canManage prop) as a courtesy.
 */

import { useState } from "react";
import { Plus, Pencil, Trash2, Lock, Globe, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { KbEntry, KbCategory, KbVisibility } from "@/lib/quoting-common/domain/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  initialEntries: KbEntry[];
  canManage:      boolean;
};

type DraftForm = {
  id?:        string;
  title:      string;
  body:       string;
  category:   KbCategory;
  visibility: KbVisibility;
  source:     string;
};

const EMPTY_FORM: DraftForm = {
  title:      "",
  body:       "",
  category:   "faq",
  visibility: "internal_only",
  source:     "",
};

const CATEGORY_LABELS: Record<KbCategory, string> = {
  faq:    "FAQ",
  policy: "Policy",
  spec:   "Specifikation",
  caveat: "Förbehåll",
  other:  "Övrigt",
};

// ── Styling helpers ─────────────────────────────────────────────────────────

const INPUT_CLASS =
  "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-colors";
const LABEL_CLASS = "block text-[11px] font-medium text-white/50 mb-1";

// ── Component ─────────────────────────────────────────────────────────────────

export function KbManager({ initialEntries, canManage }: Props) {
  const [entries, setEntries]   = useState<KbEntry[]>(initialEntries);
  const [filter, setFilter]     = useState<"all" | KbVisibility>("all");
  const [form, setForm]         = useState<DraftForm | null>(null);
  const [saving, setSaving]     = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toasts, toast, dismiss } = useToast();

  const visible = entries.filter((e) => filter === "all" || e.visibility === filter);

  // ── Create / update ─────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form) return;
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Titel och innehåll krävs.");
      return;
    }
    setSaving(true);

    const isEdit = Boolean(form.id);
    const payload = {
      title:      form.title.trim(),
      body:       form.body.trim(),
      category:   form.category,
      visibility: form.visibility,
      vertical:   "solar",
      source:     form.source.trim() || undefined,
    };

    try {
      const res = await fetch(
        isEdit ? `/api/quoting/kb/${form.id}` : "/api/quoting/kb",
        {
          method:  isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        },
      );
      const json = await res.json() as { entry?: KbEntry; error?: string };

      if (!res.ok || !json.entry) {
        toast.error(json.error ?? "Kunde inte spara posten.");
        return;
      }

      setEntries((prev) =>
        isEdit
          ? prev.map((e) => (e.id === json.entry!.id ? json.entry! : e))
          : [json.entry!, ...prev],
      );
      toast.success(isEdit ? "Post uppdaterad." : "Post skapad.");
      setForm(null);
    } catch {
      toast.error("Nätverksfel. Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/quoting/kb/${deleteId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        toast.error(json.error ?? "Kunde inte ta bort posten.");
        return;
      }
      setEntries((prev) => prev.filter((e) => e.id !== deleteId));
      toast.success("Post borttagen.");
      setDeleteId(null);
    } catch {
      toast.error("Nätverksfel. Försök igen.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.07] p-0.5">
          {(["all", "customer_facing", "internal_only"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                filter === f ? "bg-white/[0.08] text-white" : "text-white/45 hover:text-white/70",
              )}
            >
              {f === "all" ? "Alla" : f === "customer_facing" ? "Kundvänd" : "Intern"}
            </button>
          ))}
        </div>

        {canManage && (
          <Button size="sm" onClick={() => setForm({ ...EMPTY_FORM })}>
            <Plus size={14} className="mr-1.5" />
            Ny post
          </Button>
        )}
      </div>

      {/* Empty state */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium text-white/65">Inga poster</p>
          <p className="text-xs text-white/40 mt-1">
            {canManage ? "Skapa din första kunskapsbaspost." : "Inga poster matchar filtret."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((entry) => (
            <Card key={entry.id} variant="default" padding="md">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <VisibilityBadge visibility={entry.visibility} />
                    <span className="text-[11px] text-white/40">
                      {CATEGORY_LABELS[entry.category]}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white truncate">{entry.title}</h3>
                  <p className="text-xs text-white/55 mt-1 leading-relaxed line-clamp-2">
                    {entry.body}
                  </p>
                  {entry.source && (
                    <p className="text-[11px] text-white/30 mt-1.5">Källa: {entry.source}</p>
                  )}
                </div>

                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() =>
                        setForm({
                          id:         entry.id,
                          title:      entry.title,
                          body:       entry.body,
                          category:   entry.category,
                          visibility: entry.visibility,
                          source:     entry.source ?? "",
                        })
                      }
                      className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                      aria-label="Redigera"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteId(entry.id)}
                      className="p-1.5 rounded-md text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      aria-label="Ta bort"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit / create modal */}
      {form && (
        <EntryFormModal
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onClose={() => setForm(null)}
          saving={saving}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Ta bort kunskapsbaspost?"
        body="Posten tas bort permanent. Det här går inte att ångra."
        confirmLabel="Ta bort"
        tone="danger"
        pending={deleting}
      />
    </div>
  );
}

// ── Visibility badge ──────────────────────────────────────────────────────────

function VisibilityBadge({ visibility }: { visibility: KbVisibility }) {
  if (visibility === "customer_facing") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-300">
        <Globe size={11} />
        Kundvänd
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/[0.06] text-white/60">
      <Lock size={11} />
      Intern
    </span>
  );
}

// ── Form modal ──────────────────────────────────────────────────────────────

function EntryFormModal({
  form,
  setForm,
  onSave,
  onClose,
  saving,
}: {
  form:    DraftForm;
  setForm: (f: DraftForm) => void;
  onSave:  () => void;
  onClose: () => void;
  saving:  boolean;
}) {
  const isEdit = Boolean(form.id);
  const promoting = isEdit && form.visibility === "customer_facing";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[hsl(var(--surface-elev-2))] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-white">
            {isEdit ? "Redigera post" : "Ny kunskapsbaspost"}
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Stäng"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={LABEL_CLASS}>Titel</label>
            <input
              className={INPUT_CLASS}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="t.ex. 25-årig produktionsgaranti"
              maxLength={300}
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Innehåll</label>
            <textarea
              className={cn(INPUT_CLASS, "resize-none")}
              rows={5}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Faktatext som AI:n får grunda offerten på."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Kategori</label>
              <select
                className={cn(INPUT_CLASS, "[color-scheme:dark]")}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as KbCategory })}
              >
                {(Object.keys(CATEGORY_LABELS) as KbCategory[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>Synlighet</label>
              <select
                className={cn(INPUT_CLASS, "[color-scheme:dark]")}
                value={form.visibility}
                onChange={(e) => setForm({ ...form, visibility: e.target.value as KbVisibility })}
              >
                <option value="internal_only">Intern (säker)</option>
                <option value="customer_facing">Kundvänd</option>
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Källa (valfritt)</label>
            <input
              className={INPUT_CLASS}
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="t.ex. produktblad, leverantörsavtal"
              maxLength={200}
            />
          </div>

          {/* Visibility promotion warning */}
          {promoting && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
              <p className="text-[11px] text-amber-400/90 leading-relaxed">
                ⚠ Kundvänt innehåll kan nå kunden i offerttext och PDF. Säkerställ
                att posten inte innehåller interna marginaler, inköpspriser eller
                känsliga villkor.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Avbryt
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? "Sparar…" : isEdit ? "Spara ändringar" : "Skapa post"}
          </Button>
        </div>
      </div>
    </div>
  );
}
