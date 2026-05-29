/**
 * /q/[token] — public, unauthenticated customer view of a quote.
 *
 * Access is granted by a signed share token (see quoting-common/sharing/token).
 * No Clerk session required. The token authorises exactly one quote.
 *
 * SECURITY:
 *   - The token's HMAC is verified before any DB read.
 *   - The egress gate scans the assembled customer-visible text against the
 *     org's internal_only KB entries; if it fires the content is withheld.
 *   - Only customer-facing data is rendered — never internal fields.
 *
 * Side effect: opening a `sent` quote advances it to `viewed` (open tracking).
 */

import { notFound } from "next/navigation";
import { verifyShareToken } from "@/lib/quoting-common/sharing/token";
import {
  getQuote,
  updateQuote,
  getOrganizationName,
} from "@/lib/quoting-common/data/quotes";
import { getCustomer } from "@/lib/quoting-common/data/customers";
import { listKbEntries, listCustomerFacingEntries } from "@/lib/quoting-common/data/kb";
import { runEgressGate } from "@/lib/quoting-common/egress/gate";
import type { QuoteStatus } from "@/lib/quoting-common/domain/types";
import { AcceptForm } from "./AcceptForm";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Din offert", robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }> };

/**
 * Vertical-agnostic figure list persisted by the send route into
 * quote.meta.roiSummary — keeps this public view decoupled from any vertical.
 */
type RoiFigure = { label: string; value: string };

function readRoiSummary(meta: Record<string, unknown> | null | undefined): RoiFigure[] {
  const raw = meta?.roiSummary;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is RoiFigure =>
      typeof f === "object" && f !== null &&
      typeof (f as RoiFigure).label === "string" &&
      typeof (f as RoiFigure).value === "string",
  );
}

// Statuses where the customer may still accept the quote.
const ACCEPTABLE: QuoteStatus[] = ["sent", "viewed", "accepted"];

export default async function PublicQuotePage({ params }: Props) {
  const { token } = await params;

  const claims = verifyShareToken(token);
  if (!claims) notFound();

  const { orgId, quoteId } = claims;
  const quote = await getQuote(orgId, quoteId);
  if (!quote) notFound();

  const [customer, cfEntries, internalEntries, orgName] = await Promise.all([
    quote.customerId ? getCustomer(orgId, quote.customerId) : Promise.resolve(null),
    listCustomerFacingEntries(orgId, quote.vertical),
    listKbEntries(orgId, { visibility: "internal_only" }),
    getOrganizationName(orgId),
  ]);

  const narrative = typeof quote.meta?.narrativeText === "string" ? quote.meta.narrativeText : "";
  const figures = readRoiSummary(quote.meta);

  // Egress gate over assembled customer-visible text
  const assembled = [narrative, ...cfEntries.map((e) => e.body)].join("\n\n");
  const egress = runEgressGate({ renderedText: assembled }, internalEntries);

  // View tracking — advance sent → viewed (idempotent, fire-and-forget)
  if (quote.status === "sent") {
    try { await updateQuote(orgId, quoteId, { status: "viewed" }); } catch { /* non-fatal */ }
  }

  const status = quote.status as QuoteStatus;
  const alreadySigned = status === "signed";
  const isExpired     = status === "expired";
  const isRejected    = status === "rejected";
  const canAccept     = ACCEPTABLE.includes(status) && egress.ok;
  const display       = orgName ?? "Mailmind";

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4">
      <div className="mx-auto max-w-2xl bg-white rounded-xl shadow-xl px-8 py-10 sm:px-12">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-6 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Din offert</h1>
            <p className="text-sm text-slate-500 mt-1">{display}</p>
          </div>
          <div className="text-right text-sm text-slate-500">
            <p className="font-mono font-semibold text-slate-700">{quote.number ?? quoteId.slice(0, 8)}</p>
            <p className="mt-1">{new Date(quote.createdAt).toLocaleDateString("sv-SE")}</p>
          </div>
        </div>

        {!egress.ok ? (
          <div className="rounded-lg bg-slate-50 px-5 py-6 text-center">
            <p className="text-sm font-medium text-slate-700">Offerten är inte tillgänglig just nu.</p>
            <p className="text-xs text-slate-500 mt-1">Kontakta din säljare för en uppdaterad version.</p>
          </div>
        ) : (
          <>
            {customer && (
              <div className="mb-8">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Kund</p>
                <p className="text-base font-medium text-slate-800">{customer.name}</p>
              </div>
            )}

            {narrative && (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap mb-8">{narrative}</p>
            )}

            {figures.length > 0 && (
              <div className="mb-8">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-3">
                  Beräknad avkastning
                </p>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {figures.map((f) => (
                      <Row key={f.label} label={f.label} value={f.value} />
                    ))}
                  </tbody>
                </table>
              </div>
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
              <p className="text-sm text-slate-500 border-t border-slate-200 pt-4 mb-8">
                Offerten gäller till och med {new Date(quote.validUntil).toLocaleDateString("sv-SE")}.
              </p>
            )}

            {/* Acceptance area */}
            {alreadySigned ? (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-center">
                <p className="text-sm font-semibold text-emerald-800">Offerten är redan accepterad. Tack!</p>
              </div>
            ) : isExpired ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-center">
                <p className="text-sm font-medium text-amber-800">Offerten har gått ut.</p>
                <p className="text-xs text-amber-700 mt-1">Kontakta din säljare för en ny offert.</p>
              </div>
            ) : isRejected ? (
              <div className="rounded-xl border border-slate-300 bg-slate-50 px-5 py-4 text-center">
                <p className="text-sm text-slate-600">Offerten är inte längre aktiv.</p>
              </div>
            ) : canAccept ? (
              <AcceptForm token={token} />
            ) : null}
          </>
        )}

        <div className="mt-10 pt-6 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400">{display}</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr>
      <td className="py-2 text-slate-600">{label}</td>
      <td className={`py-2 text-right tabular-nums ${strong ? "font-semibold text-slate-900" : "text-slate-700"}`}>
        {value}
      </td>
    </tr>
  );
}
