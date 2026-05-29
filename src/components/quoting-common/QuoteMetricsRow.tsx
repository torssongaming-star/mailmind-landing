/**
 * QuoteMetricsRow — at-a-glance KPIs computed from a vertical's quotes.
 *
 * Pure presentational server component. Derives everything from the quote list
 * the dashboard already fetches — no extra queries.
 *
 *   Pipeline   = Σ total of active quotes (not terminal: draft…accepted)
 *   Vunnet     = Σ total of signed quotes
 *   Konvertering = signed / (quotes that were sent out)
 */

import type { Quote, QuoteStatus } from "@/lib/quoting-common/domain/types";

const TERMINAL: QuoteStatus[] = ["signed", "rejected", "expired"];
// Statuses that represent a quote that left the building (was sent to a customer).
const SENT_OUT: QuoteStatus[] = ["sent", "viewed", "accepted", "signed", "rejected", "expired"];

function num(total: string | null): number {
  if (!total) return 0;
  const n = Number(total);
  return Number.isFinite(n) ? n : 0;
}

function sek(n: number): string {
  return `${Math.round(n).toLocaleString("sv-SE")} kr`;
}

export function QuoteMetricsRow({ quotes }: { quotes: Quote[] }) {
  const pipeline = quotes
    .filter((q) => !TERMINAL.includes(q.status))
    .reduce((sum, q) => sum + num(q.total), 0);

  const won = quotes
    .filter((q) => q.status === "signed")
    .reduce((sum, q) => sum + num(q.total), 0);

  const sentOut = quotes.filter((q) => SENT_OUT.includes(q.status)).length;
  const signed  = quotes.filter((q) => q.status === "signed").length;
  const conversion = sentOut > 0 ? Math.round((signed / sentOut) * 100) : null;

  const cards: Array<{ label: string; value: string; sub?: string }> = [
    { label: "Pipeline", value: sek(pipeline), sub: "aktiva offerter" },
    { label: "Vunnet", value: sek(won), sub: `${signed} signerade` },
    { label: "Konvertering", value: conversion === null ? "—" : `${conversion} %`, sub: `av ${sentOut} skickade` },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <p className="text-xs text-white/50 font-medium">{c.label}</p>
          <p className="text-2xl font-bold text-white tabular-nums mt-1">{c.value}</p>
          {c.sub && <p className="text-[11px] text-white/40 mt-0.5">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}
