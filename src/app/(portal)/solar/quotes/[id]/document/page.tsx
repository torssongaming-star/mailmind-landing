/**
 * /solar/quotes/[id]/document — printable customer-facing quote document.
 *
 * Renders a clean A4-style document the salesperson can print or save as PDF
 * (browser print dialog). This is the MVP delivery surface — a true PDF
 * renderer (e.g. @react-pdf/renderer) would add ~2 MB + serverless cold-start
 * cost; a print-optimised HTML page produces identical single-page output
 * with zero new dependencies.
 *
 * SECURITY: the egress gate runs on the assembled customer-visible text
 * before render. If it fires (internal data leak / unfilled placeholder),
 * the narrative is withheld and a warning shown instead — the document never
 * leaks internal_only content.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { getQuote } from "@/lib/quoting-common/data/quotes";
import { getCustomer } from "@/lib/quoting-common/data/customers";
import { getLatestScenario } from "@/lib/solar/data/scenarios";
import { listKbEntries, listCustomerFacingEntries } from "@/lib/quoting-common/data/kb";
import { runEgressGate } from "@/lib/quoting-common/egress/gate";
import type { SolarEngineResult } from "@/lib/solar/engine/types";
import { PrintButton } from "./PrintButton";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Offertdokument — Solar" };

type Props = { params: Promise<{ id: string }> };

// ── Format helpers ────────────────────────────────────────────────────────────

function fmt(n: number, d = 0): string {
  return n.toLocaleString("sv-SE", { minimumFractionDigits: d, maximumFractionDigits: d });
}
const sek  = (n: number) => `${fmt(Math.round(n))} kr`;
const kwh  = (n: number) => `${fmt(Math.round(n))} kWh`;

export default async function SolarQuoteDocumentPage({ params }: Props) {
  const { id } = await params;

  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!hasProductAccess(account, "solar")) redirect("/app");

  const orgId = account.organization!.id;
  const quote = await getQuote(orgId, id);
  if (!quote) notFound();

  const [customer, scenario, cfEntries, internalEntries] = await Promise.all([
    quote.customerId ? getCustomer(orgId, quote.customerId) : Promise.resolve(null),
    getLatestScenario(orgId, id),
    listCustomerFacingEntries(orgId, "solar"),
    listKbEntries(orgId, { visibility: "internal_only" }),
  ]);

  const result = (scenario?.results as SolarEngineResult | undefined) ?? null;
  const customerName = customer?.name ?? "Kund";
  const orgName = account.organization!.name ?? "Mailmind Solar";

  // Narrative persisted on the quote (set from the builder's "Spara utkast").
  const rawNarrative =
    typeof quote.meta?.narrativeText === "string" ? quote.meta.narrativeText : "";

  // ── Egress gate ─────────────────────────────────────────────────────────────
  // Scan the assembled customer-visible text (narrative + KB bodies) for leaks.
  const assembled = [rawNarrative, ...cfEntries.map((e) => e.body)].join("\n\n");
  const egress = runEgressGate({ renderedText: assembled }, internalEntries);
  const narrative = egress.ok ? rawNarrative : "";

  return (
    <div className="min-h-screen bg-[hsl(var(--surface-base))] print:bg-white">
      {/* Print-specific styling */}
      <style>{`
        @media print {
          @page { size: A4; margin: 18mm 16mm; }
          body { background: white !important; }
          .doc-sheet { box-shadow: none !important; border: none !important; margin: 0 !important; }
        }
      `}</style>

      {/* Toolbar (hidden in print) */}
      <div className="print:hidden border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Link
          href={`/solar/quotes/${id}`}
          className="flex items-center gap-1.5 text-xs text-white/45 hover:text-white transition-colors"
        >
          <ArrowLeft size={13} />
          Tillbaka till offert
        </Link>
        <PrintButton />
      </div>

      {/* Egress block notice (hidden in print — there's nothing to print) */}
      {!egress.ok && (
        <div className="print:hidden max-w-3xl mx-auto mt-6 rounded-xl border border-red-500/25 bg-red-500/5 px-5 py-4">
          <p className="text-sm font-semibold text-red-400">Dokumentet kan inte visas</p>
          <p className="text-xs text-red-400/80 mt-1 leading-relaxed">
            Egress-grinden blockerade innehållet ({egress.blockedReasons.join(", ")}).
            Offerttexten eller en kunskapsbaspost innehåller troligen interna data
            eller ifyllningsmarkörer. Åtgärda i offerten innan dokumentet skapas.
          </p>
        </div>
      )}

      {/* Document sheet */}
      <div className="doc-sheet mx-auto my-6 max-w-3xl bg-white text-slate-900 rounded-lg shadow-2xl print:my-0 px-12 py-12 print:px-0 print:py-0">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-6 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Offert — Solcellsanläggning</h1>
            <p className="text-sm text-slate-500 mt-1">{orgName}</p>
          </div>
          <div className="text-right text-sm text-slate-500">
            <p className="font-mono font-semibold text-slate-700">{quote.number ?? id.slice(0, 8)}</p>
            <p className="mt-1">{new Date(quote.createdAt).toLocaleDateString("sv-SE")}</p>
          </div>
        </div>

        {/* Customer */}
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Kund</p>
          <p className="text-base font-medium text-slate-800">{customerName}</p>
          {customer?.email && <p className="text-sm text-slate-500">{customer.email}</p>}
          {customer?.address?.street && (
            <p className="text-sm text-slate-500">
              {customer.address.street}
              {customer.address.postalCode ? `, ${customer.address.postalCode}` : ""}
              {customer.address.city ? ` ${customer.address.city}` : ""}
            </p>
          )}
        </div>

        {/* Narrative */}
        {narrative && (
          <div className="mb-8">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{narrative}</p>
          </div>
        )}

        {/* ROI figures */}
        {result ? (
          <div className="mb-8">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-3">
              Beräknad avkastning
            </p>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                <DocRow label="Årsproduktion (år 1)" value={kwh(result.annualProductionKwhY1)} />
                <DocRow label="Egenanvändning" value={`${kwh(result.selfConsumptionKwhY1)} (${(result.selfConsumptionRate * 100).toFixed(0)} %)`} />
                <DocRow label="Årlig besparing (år 1)" value={sek(result.annualSavingsSekY1)} strong />
                <DocRow label="ROT-avdrag" value={sek(result.rotDeductionSek)} />
                <DocRow label="Nettokostnad efter ROT" value={sek(result.netSystemCostSek)} strong />
                <DocRow label="Återbetalningstid" value={`${fmt(result.paybackYears, 1)} år`} strong />
                <DocRow label="Nuvärde (NPV, 25 år)" value={sek(result.npv)} />
                <DocRow label="CO₂-besparing" value={`${fmt(result.co2AvoidedKgPerYearY1)} kg/år`} />
              </tbody>
            </table>
            <p className="text-[10px] text-slate-400 mt-2">
              Beräkning enligt {result.engineVersion}. Värden är uppskattningar baserade på
              angivna förutsättningar och garanterar inte faktiskt utfall.
            </p>
          </div>
        ) : (
          <div className="mb-8 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Ingen ROI-beräkning är sparad för den här offerten ännu.
          </div>
        )}

        {/* Customer-facing KB highlights */}
        {cfEntries.length > 0 && (
          <div className="mb-8">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-3">
              Vad som ingår
            </p>
            <ul className="space-y-2">
              {cfEntries.slice(0, 6).map((e) => (
                <li key={e.id} className="text-sm text-slate-700">
                  <span className="font-medium text-slate-800">{e.title}.</span>{" "}
                  {e.body}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Validity */}
        {quote.validUntil && (
          <p className="text-sm text-slate-500 border-t border-slate-200 pt-4">
            Offerten gäller till och med {new Date(quote.validUntil).toLocaleDateString("sv-SE")}.
          </p>
        )}

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400">{orgName} · Genererad {new Date().toLocaleDateString("sv-SE")}</p>
        </div>
      </div>
    </div>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────

function DocRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr>
      <td className="py-2 text-slate-600">{label}</td>
      <td className={`py-2 text-right tabular-nums ${strong ? "font-semibold text-slate-900" : "text-slate-700"}`}>
        {value}
      </td>
    </tr>
  );
}
