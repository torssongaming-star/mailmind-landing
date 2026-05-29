"use client";

/**
 * QuoteLinesEditor — editable line-item table for a quote.
 *
 * Add/edit/remove rows; live subtotal + VAT + total. Saves the full set via
 * PUT /api/quoting/quotes/[id]/lines, which replaces lines and recomputes the
 * quote header totals server-side.
 */

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import type { QuoteLine } from "@/lib/quoting-common/domain/types";

type Row = { _key: string; description: string; qty: number; unitPrice: number };

const VAT_RATE = 0.25;

const INPUT = "w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors";

function key() { return Math.random().toString(36).slice(2, 9); }
function sek(n: number) { return `${Math.round(n).toLocaleString("sv-SE")} kr`; }

export function QuoteLinesEditor({
  quoteId,
  initialLines,
  canManage,
}: {
  quoteId:      string;
  initialLines: QuoteLine[];
  canManage:    boolean;
}) {
  const [rows, setRows] = useState<Row[]>(
    initialLines.map((l) => ({ _key: key(), description: l.description, qty: Number(l.qty), unitPrice: Number(l.unitPrice) })),
  );
  const [saving, setSaving] = useState(false);
  const { toasts, toast, dismiss } = useToast();

  const subtotal = rows.reduce((s, r) => s + r.qty * r.unitPrice, 0);
  const vat = subtotal * VAT_RATE;
  const total = subtotal + vat;

  function update(k: string, field: keyof Omit<Row, "_key">, raw: string) {
    setRows((prev) => prev.map((r) => {
      if (r._key !== k) return r;
      if (field === "description") return { ...r, description: raw };
      const n = parseFloat(raw);
      return { ...r, [field]: isNaN(n) ? 0 : n };
    }));
  }

  function addRow() { setRows((p) => [...p, { _key: key(), description: "", qty: 1, unitPrice: 0 }]); }
  function removeRow(k: string) { setRows((p) => p.filter((r) => r._key !== k)); }

  async function save() {
    const clean = rows.filter((r) => r.description.trim());
    setSaving(true);
    try {
      const res = await fetch(`/api/quoting/quotes/${quoteId}/lines`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ vatRate: VAT_RATE, lines: clean.map((r) => ({ description: r.description.trim(), qty: r.qty, unitPrice: r.unitPrice })) }),
      });
      const json = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { toast.error(json.error ?? "Kunde inte spara rader."); return; }
      toast.success("Rader sparade.");
    } catch {
      toast.error("Nätverksfel. Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="default" padding="md">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <CardHeader title="Offertrader" description="Specificera poster — summor uppdateras automatiskt." />

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left text-[11px] font-semibold text-white/40 uppercase tracking-wider px-2 py-2">Beskrivning</th>
                <th className="text-right text-[11px] font-semibold text-white/40 uppercase tracking-wider px-2 py-2 w-20">Antal</th>
                <th className="text-right text-[11px] font-semibold text-white/40 uppercase tracking-wider px-2 py-2 w-28">À-pris</th>
                <th className="text-right text-[11px] font-semibold text-white/40 uppercase tracking-wider px-2 py-2 w-28">Summa</th>
                {canManage && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._key} className="border-b border-white/[0.04]">
                  <td className="px-2 py-1.5">
                    {canManage
                      ? <input className={INPUT} value={r.description} onChange={(e) => update(r._key, "description", e.target.value)} placeholder="t.ex. Montage solpaneler" />
                      : <span className="text-white/80">{r.description}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {canManage
                      ? <input type="number" min={0} step={0.5} className={`${INPUT} text-right`} value={r.qty} onChange={(e) => update(r._key, "qty", e.target.value)} />
                      : <span className="text-white/70 tabular-nums">{r.qty}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {canManage
                      ? <input type="number" min={0} step={100} className={`${INPUT} text-right`} value={r.unitPrice} onChange={(e) => update(r._key, "unitPrice", e.target.value)} />
                      : <span className="text-white/70 tabular-nums">{sek(r.unitPrice)}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right text-white/80 tabular-nums">{sek(r.qty * r.unitPrice)}</td>
                  {canManage && (
                    <td className="px-1 py-1.5 text-right">
                      <button onClick={() => removeRow(r._key)} className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors" aria-label="Ta bort rad">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 0 && (
        <p className="text-xs text-white/40 py-4 text-center">Inga rader ännu.</p>
      )}

      {/* Totals */}
      <div className="mt-4 space-y-1 text-sm max-w-xs ml-auto">
        <div className="flex justify-between text-white/60"><span>Delsumma</span><span className="tabular-nums">{sek(subtotal)}</span></div>
        <div className="flex justify-between text-white/60"><span>Moms (25 %)</span><span className="tabular-nums">{sek(vat)}</span></div>
        <div className="flex justify-between font-semibold text-white border-t border-white/[0.07] pt-1 mt-1"><span>Totalt</span><span className="tabular-nums">{sek(total)}</span></div>
      </div>

      {canManage && (
        <div className="flex items-center justify-between mt-4">
          <button onClick={addRow} className="text-xs text-primary/70 hover:text-primary transition-colors font-medium">+ Lägg till rad</button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? "Sparar…" : "Spara rader"}</Button>
        </div>
      )}
    </Card>
  );
}
