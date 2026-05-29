/**
 * /construction/quotes/[id]/document — printable customer-facing quote.
 *
 * Reads display figures from quote.meta.roiSummary (persisted by the
 * construction calculate route) — no vertical engine import needed.
 * Egress gate scans assembled customer text before render.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { getQuote } from "@/lib/quoting-common/data/quotes";
import { getCustomer } from "@/lib/quoting-common/data/customers";
import { listKbEntries, listCustomerFacingEntries } from "@/lib/quoting-common/data/kb";
import { runEgressGate } from "@/lib/quoting-common/egress/gate";
import { PrintButton } from "./PrintButton";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Offertdokument — Construction" };

type Props = { params: Promise<{ id: string }> };
type Figure = { label: string; value: string };

function readFigures(meta: Record<string, unknown> | null | undefined): Figure[] {
  const raw = meta?.roiSummary;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is Figure =>
      typeof f === "object" && f !== null &&
      typeof (f as Figure).label === "string" && typeof (f as Figure).value === "string",
  );
}

export default async function ConstructionQuoteDocumentPage({ params }: Props) {
  const { id } = await params;

  const { userId } = await auth();
  if (!userId) redirect("/login");

  const account = await getCurrentAccount(userId);
  if (!account.user) redirect("/app/onboarding");
  if (!hasProductAccess(account, "construction")) redirect("/app");

  const orgId = account.organization!.id;
  const quote = await getQuote(orgId, id);
  if (!quote) notFound();

  const [customer, cfEntries, internalEntries] = await Promise.all([
    quote.customerId ? getCustomer(orgId, quote.customerId) : Promise.resolve(null),
    listCustomerFacingEntries(orgId, "construction"),
    listKbEntries(orgId, { visibility: "internal_only" }),
  ]);

  const orgName = account.organization!.name ?? "Mailmind";
  const customerName = customer?.name ?? "Kund";
  const rawNarrative = typeof quote.meta?.narrativeText === "string" ? quote.meta.narrativeText : "";
  const figures = readFigures(quote.meta);

  const assembled = [rawNarrative, ...cfEntries.map((e) => e.body)].join("\n\n");
  const egress = runEgressGate({ renderedText: assembled }, internalEntries);
  const narrative = egress.ok ? rawNarrative : "";

  return (
    <div className="min-h-screen bg-[hsl(var(--surface-base))] print:bg-white">
      <style>{`
        @media print {
          @page { size: A4; margin: 18mm 16mm; }
          body { background: white !important; }
          .doc-sheet { box-shadow: none !important; border: none !important; margin: 0 !important; }
        }
      `}</style>

      <div className="print:hidden border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Link href={`/construction/quotes/${id}`} className="flex items-center gap-1.5 text-xs text-white/45 hover:text-white transition-colors">
          <ArrowLeft size={13} />
          Tillbaka till offert
        </Link>
        <PrintButton />
      </div>

      {!egress.ok && (
        <div className="print:hidden max-w-3xl mx-auto mt-6 rounded-xl border border-red-500/25 bg-red-500/5 px-5 py-4">
          <p className="text-sm font-semibold text-red-400">Dokumentet kan inte visas</p>
          <p className="text-xs text-red-400/80 mt-1 leading-relaxed">
            Egress-grinden blockerade innehållet ({egress.blockedReasons.join(", ")}). Åtgärda i offerten innan dokumentet skapas.
          </p>
        </div>
      )}

      <div className="doc-sheet mx-auto my-6 max-w-3xl bg-white text-slate-900 rounded-lg shadow-2xl print:my-0 px-12 py-12 print:px-0 print:py-0">
        <div className="flex items-start justify-between border-b border-slate-200 pb-6 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Offert — Byggprojekt</h1>
            <p className="text-sm text-slate-500 mt-1">{orgName}</p>
          </div>
          <div className="text-right text-sm text-slate-500">
            <p className="font-mono font-semibold text-slate-700">{quote.number ?? id.slice(0, 8)}</p>
            <p className="mt-1">{new Date(quote.createdAt).toLocaleDateString("sv-SE")}</p>
          </div>
        </div>

        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Kund</p>
          <p className="text-base font-medium text-slate-800">{customerName}</p>
          {customer?.email && <p className="text-sm text-slate-500">{customer.email}</p>}
        </div>

        {narrative && (
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap mb-8">{narrative}</p>
        )}

        {figures.length > 0 ? (
          <div className="mb-8">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Kalkyl</p>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {figures.map((f, i) => (
                  <tr key={f.label}>
                    <td className="py-2 text-slate-600">{f.label}</td>
                    <td className={`py-2 text-right tabular-nums ${i === figures.length - 1 ? "font-semibold text-slate-900" : "text-slate-700"}`}>{f.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-400 mt-2">Värden är uppskattningar baserade på angivna förutsättningar.</p>
          </div>
        ) : (
          <div className="mb-8 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">Ingen kalkyl är sparad för den här offerten ännu.</div>
        )}

        {cfEntries.length > 0 && (
          <div className="mb-8">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Vad som ingår</p>
            <ul className="space-y-2">
              {cfEntries.slice(0, 6).map((e) => (
                <li key={e.id} className="text-sm text-slate-700">
                  <span className="font-medium text-slate-800">{e.title}.</span> {e.body}
                </li>
              ))}
            </ul>
          </div>
        )}

        {quote.validUntil && (
          <p className="text-sm text-slate-500 border-t border-slate-200 pt-4">
            Offerten gäller till och med {new Date(quote.validUntil).toLocaleDateString("sv-SE")}.
          </p>
        )}

        <div className="mt-10 pt-6 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400">{orgName} · Genererad {new Date().toLocaleDateString("sv-SE")}</p>
        </div>
      </div>
    </div>
  );
}
