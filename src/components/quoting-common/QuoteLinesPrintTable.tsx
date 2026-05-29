/**
 * QuoteLinesPrintTable — light-theme line-item table for customer documents
 * and the public quote view. Pure presentational; computes subtotal/VAT/total.
 *
 * Renders nothing when there are no lines (callers fall back to other content).
 */

import type { QuoteLine } from "@/lib/quoting-common/domain/types";

function sek(n: number): string {
  return `${Math.round(n).toLocaleString("sv-SE")} kr`;
}

type Labels = {
  title:       string;
  description: string;
  quantity:    string;
  unitPrice:   string;
  amount:      string;
  subtotal:    string;
  vat:         string;
  total:       string;
};

const SV_LABELS: Labels = {
  title:       "Specifikation",
  description: "Beskrivning",
  quantity:    "Antal",
  unitPrice:   "À-pris",
  amount:      "Summa",
  subtotal:    "Delsumma",
  vat:         "Moms (25 %)",
  total:       "Totalt",
};

export function QuoteLinesPrintTable({
  lines,
  vatRate = 0.25,
  labels,
}: {
  lines:    QuoteLine[];
  vatRate?: number;
  labels?:  Partial<Labels>;
}) {
  if (lines.length === 0) return null;

  const L = { ...SV_LABELS, ...labels };
  const subtotal = lines.reduce((s, l) => s + Number(l.lineTotal), 0);
  const vat = subtotal * vatRate;
  const total = subtotal + vat;

  return (
    <div className="mb-8">
      <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-3">{L.title}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="text-left font-medium py-1.5">{L.description}</th>
            <th className="text-right font-medium py-1.5 w-16">{L.quantity}</th>
            <th className="text-right font-medium py-1.5 w-28">{L.unitPrice}</th>
            <th className="text-right font-medium py-1.5 w-28">{L.amount}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lines.map((l) => (
            <tr key={l.id}>
              <td className="py-2 text-slate-700">{l.description}</td>
              <td className="py-2 text-right text-slate-600 tabular-nums">{Number(l.qty)}</td>
              <td className="py-2 text-right text-slate-600 tabular-nums">{sek(Number(l.unitPrice))}</td>
              <td className="py-2 text-right text-slate-800 tabular-nums">{sek(Number(l.lineTotal))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 space-y-1 text-sm max-w-[16rem] ml-auto">
        <div className="flex justify-between text-slate-600"><span>{L.subtotal}</span><span className="tabular-nums">{sek(subtotal)}</span></div>
        <div className="flex justify-between text-slate-600"><span>{L.vat}</span><span className="tabular-nums">{sek(vat)}</span></div>
        <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-200 pt-1 mt-1"><span>{L.total}</span><span className="tabular-nums">{sek(total)}</span></div>
      </div>
    </div>
  );
}
