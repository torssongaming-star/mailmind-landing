"use client";

/**
 * CustomerManager — create/edit customers for a quoting vertical.
 *
 * Shared across verticals (lives in quoting-common). Lists customers, opens a
 * modal to create or edit. No delete — customers are referenced by quotes (FK);
 * archive/merge is future work.
 *
 * POST   /api/quoting/customers        (create — needs vertical for product gate)
 * PATCH  /api/quoting/customers/[id]   (edit)
 */

import { useState } from "react";
import { Plus, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import type { Customer } from "@/lib/quoting-common/domain/types";

type Props = {
  initialCustomers: Customer[];
  vertical:         string;
};

type DraftForm = {
  id?:       string;
  name:      string;
  email:     string;
  phone:     string;
  orgNumber: string;
};

const EMPTY: DraftForm = { name: "", email: "", phone: "", orgNumber: "" };

const INPUT_CLASS =
  "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-colors";
const LABEL_CLASS = "block text-[11px] font-medium text-white/50 mb-1";

export function CustomerManager({ initialCustomers, vertical }: Props) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [form, setForm]           = useState<DraftForm | null>(null);
  const [saving, setSaving]       = useState(false);
  const { toasts, toast, dismiss } = useToast();

  async function handleSave() {
    if (!form) return;
    if (!form.name.trim()) { toast.error("Namn krävs."); return; }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("Ogiltig e-postadress."); return;
    }
    setSaving(true);

    const isEdit = Boolean(form.id);
    const payload = {
      name:      form.name.trim(),
      email:     form.email.trim() || undefined,
      phone:     form.phone.trim() || undefined,
      orgNumber: form.orgNumber.trim() || undefined,
      ...(isEdit ? {} : { vertical }),
    };

    try {
      const res = await fetch(
        isEdit ? `/api/quoting/customers/${form.id}` : "/api/quoting/customers",
        { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      );
      const json = await res.json() as { customer?: Customer; error?: string };
      if (!res.ok || !json.customer) { toast.error(json.error ?? "Kunde inte spara."); return; }

      setCustomers((prev) =>
        isEdit ? prev.map((c) => (c.id === json.customer!.id ? json.customer! : c)) : [json.customer!, ...prev],
      );
      toast.success(isEdit ? "Kund uppdaterad." : "Kund skapad.");
      setForm(null);
    } catch {
      toast.error("Nätverksfel. Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setForm({ ...EMPTY })}>
          <Plus size={14} className="mr-1.5" />
          Ny kund
        </Button>
      </div>

      {customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4 border border-white/[0.06]">
            <Users size={20} className="text-white/30" />
          </div>
          <p className="text-sm font-medium text-white/70">Inga kunder ännu</p>
          <p className="text-xs text-white/40 mt-1">Lägg till din första kund.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left text-[11px] font-semibold text-white/40 uppercase tracking-wider px-4 py-3">Namn</th>
                <th className="text-left text-[11px] font-semibold text-white/40 uppercase tracking-wider px-4 py-3">E-post</th>
                <th className="text-left text-[11px] font-semibold text-white/40 uppercase tracking-wider px-4 py-3">Telefon</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? "bg-white/[0.015]" : ""}>
                  <td className="px-4 py-3 text-white/80 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-white/60 text-xs">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-white/60 text-xs">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setForm({ id: c.id, name: c.name, email: c.email ?? "", phone: c.phone ?? "", orgNumber: c.orgNumber ?? "" })}
                      className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                      aria-label="Redigera"
                    >
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setForm(null); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[hsl(var(--surface-elev-2))] p-6 shadow-2xl">
            <h2 className="text-sm font-semibold text-white mb-5">
              {form.id ? "Redigera kund" : "Ny kund"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className={LABEL_CLASS}>Namn</label>
                <input className={INPUT_CLASS} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="För- och efternamn eller företag" />
              </div>
              <div>
                <label className={LABEL_CLASS}>E-post</label>
                <input className={INPUT_CLASS} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="kund@exempel.se" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Telefon</label>
                  <input className={INPUT_CLASS} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="070-123 45 67" />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Org.nr (valfritt)</label>
                  <input className={INPUT_CLASS} value={form.orgNumber} onChange={(e) => setForm({ ...form, orgNumber: e.target.value })} placeholder="556677-8899" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" size="sm" onClick={() => setForm(null)} disabled={saving}>Avbryt</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Sparar…" : form.id ? "Spara" : "Skapa kund"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
