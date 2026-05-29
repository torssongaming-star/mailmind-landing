"use client";

/**
 * NewQuoteButton — creates a quote and navigates to its detail/builder page.
 *
 * Opens a small dialog to pick a customer (optional) and validity date, POSTs
 * to /api/quoting/quotes, then routes to `${detailBase}/<id>`.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import type { Customer, Quote } from "@/lib/quoting-common/domain/types";

type Props = {
  vertical:   string;
  /** Path prefix to navigate to after creation, e.g. "/solar/quotes". */
  detailBase: string;
  /** Customers to choose from (id + name only needed). */
  customers:  Pick<Customer, "id" | "name">[];
};

const INPUT_CLASS =
  "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-colors [color-scheme:dark]";
const LABEL_CLASS = "block text-[11px] font-medium text-white/50 mb-1";

export function NewQuoteButton({ vertical, detailBase, customers }: Props) {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [creating, setCreating] = useState(false);
  const { toasts, toast, dismiss } = useToast();

  async function create() {
    setCreating(true);
    try {
      const res = await fetch("/api/quoting/quotes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          vertical,
          customerId: customerId || undefined,
          validUntil: validUntil || undefined,
        }),
      });
      const json = await res.json() as { quote?: Quote; error?: string };
      if (!res.ok || !json.quote) {
        toast.error(json.error ?? "Kunde inte skapa offert.");
        setCreating(false);
        return;
      }
      router.push(`${detailBase}/${json.quote.id}`);
    } catch {
      toast.error("Nätverksfel. Försök igen.");
      setCreating(false);
    }
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} className="mr-1.5" />
        Ny offert
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !creating) setOpen(false); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[hsl(var(--surface-elev-2))] p-6 shadow-2xl">
            <h2 className="text-sm font-semibold text-white mb-5">Ny offert</h2>
            <div className="space-y-4">
              <div>
                <label className={LABEL_CLASS}>Kund</label>
                <select className={INPUT_CLASS} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">— Ingen kund ännu —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {customers.length === 0 && (
                  <p className="text-[11px] text-white/40 mt-1">Tips: lägg till kunder under Kunder först.</p>
                )}
              </div>
              <div>
                <label className={LABEL_CLASS}>Giltig till (valfritt)</label>
                <input type="date" className={INPUT_CLASS} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={creating}>Avbryt</Button>
              <Button size="sm" onClick={create} disabled={creating}>
                {creating ? "Skapar…" : "Skapa & öppna"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
