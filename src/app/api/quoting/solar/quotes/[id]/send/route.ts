/**
 * POST /api/quoting/solar/quotes/[id]/send
 *
 * Sends a solar quote to the customer by email and advances the quote to
 * `sent`. The email contains the quote summary inline (narrative + ROI
 * figures) — there is no public customer portal yet, so we deliver the
 * content directly rather than a link behind auth.
 *
 * Lifecycle:
 *   auth → account → product-access('solar') → quote + customer load →
 *   egress gate → status transition (→ready→sent) → Resend → workflow event
 *
 * SECURITY: the egress gate scans the assembled customer-visible text against
 * internal_only KB entries. If it fires, the send is refused (422) — internal
 * data never leaves the system.
 *
 * Mutation requires owner/admin (sending commits the org to a customer offer).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { requireOrgAdmin } from "@/lib/app/rbac";
import { getQuote, updateQuote, appendWorkflowEvent } from "@/lib/quoting-common/data/quotes";
import { getCustomer } from "@/lib/quoting-common/data/customers";
import { getLatestScenario } from "@/lib/solar/data/scenarios";
import { listKbEntries, listCustomerFacingEntries } from "@/lib/quoting-common/data/kb";
import { runEgressGate } from "@/lib/quoting-common/egress/gate";
import { canTransition } from "@/lib/quoting-common/domain/quote-state";
import { createShareToken, isShareConfigured } from "@/lib/quoting-common/sharing/token";
import { renderQuotePdf } from "@/lib/quoting-common/pdf/quote-pdf";
import { sendEmail } from "@/lib/app/email";
import { writeAuditLog } from "@/lib/app/audit";
import type { SolarEngineResult } from "@/lib/solar/engine/types";
import type { QuoteStatus } from "@/lib/quoting-common/domain/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// ── Email body builders ─────────────────────────────────────────────────────

function fmt(n: number, d = 0): string {
  return n.toLocaleString("sv-SE", { minimumFractionDigits: d, maximumFractionDigits: d });
}
const sek = (n: number) => `${fmt(Math.round(n))} kr`;
const kwh = (n: number) => `${fmt(Math.round(n))} kWh`;

function buildEmail(opts: {
  customerName: string;
  orgName:      string;
  quoteNumber:  string;
  narrative:    string;
  result:       SolarEngineResult | null;
  validUntil:   string | null;
  acceptUrl:    string | null;
}): { subject: string; text: string; html: string } {
  const { customerName, orgName, quoteNumber, narrative, result, validUntil, acceptUrl } = opts;
  const subject = `Offert ${quoteNumber} — Solcellsanläggning från ${orgName}`;

  const figures: Array<[string, string]> = result
    ? [
        ["Årsproduktion (år 1)", kwh(result.annualProductionKwhY1)],
        ["Årlig besparing (år 1)", sek(result.annualSavingsSekY1)],
        ["ROT-avdrag", sek(result.rotDeductionSek)],
        ["Nettokostnad efter ROT", sek(result.netSystemCostSek)],
        ["Återbetalningstid", `${fmt(result.paybackYears, 1)} år`],
      ]
    : [];

  // Plain text
  const textLines = [
    `Hej ${customerName},`,
    "",
    narrative || "Tack för ditt intresse. Här kommer din offert på en solcellsanläggning.",
    "",
    ...(figures.length ? ["Beräknad avkastning:", ...figures.map(([k, v]) => `  • ${k}: ${v}`), ""] : []),
    validUntil ? `Offerten gäller till och med ${new Date(validUntil).toLocaleDateString("sv-SE")}.` : "",
    acceptUrl ? `\nSe och acceptera offerten här:\n${acceptUrl}` : "",
    "",
    `Med vänliga hälsningar,`,
    orgName,
  ].filter((l) => l !== undefined);
  const text = textLines.join("\n");

  // HTML
  const figureRows = figures
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#475569;">${k}</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a;">${v}</td></tr>`,
    )
    .join("");

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
  <h2 style="font-size:18px;margin:0 0 4px;">Offert ${quoteNumber}</h2>
  <p style="color:#64748b;margin:0 0 20px;">Solcellsanläggning · ${orgName}</p>
  <p>Hej ${customerName},</p>
  ${narrative ? `<p style="line-height:1.6;white-space:pre-wrap;">${escapeHtml(narrative)}</p>` : `<p>Tack för ditt intresse. Här kommer din offert på en solcellsanläggning.</p>`}
  ${
    figures.length
      ? `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;"><tbody>${figureRows}</tbody></table>
         <p style="font-size:11px;color:#94a3b8;">Värden är uppskattningar baserade på angivna förutsättningar och garanterar inte faktiskt utfall.</p>`
      : ""
  }
  ${validUntil ? `<p style="color:#64748b;font-size:13px;">Offerten gäller till och med ${new Date(validUntil).toLocaleDateString("sv-SE")}.</p>` : ""}
  ${acceptUrl ? `<p style="margin:24px 0;"><a href="${acceptUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Se och acceptera offerten</a></p>` : ""}
  <p style="margin-top:24px;">Med vänliga hälsningar,<br><strong>${orgName}</strong></p>
</div>`.trim();

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (!account.access.canUseApp) {
    return NextResponse.json({ error: "App access blocked", reason: account.access.reason }, { status: 403 });
  }
  if (!hasProductAccess(account, "solar")) {
    return NextResponse.json({ error: "Solar product not enabled" }, { status: 403 });
  }

  const adminCheck = requireOrgAdmin(account);
  if (adminCheck) return NextResponse.json(adminCheck.body, { status: adminCheck.status });

  const orgId = account.organization.id;
  const quote = await getQuote(orgId, id);
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  // Must have a customer with an email
  const customer = quote.customerId ? await getCustomer(orgId, quote.customerId) : null;
  if (!customer?.email) {
    return NextResponse.json(
      { error: "Kunden saknar e-postadress", reason: "customer_email_required" },
      { status: 422 },
    );
  }

  // Verify a transition to `sent` is reachable from the current status
  const status = quote.status as QuoteStatus;
  const directToSent = canTransition(status, "sent");
  const viaReady     = status !== "ready" && canTransition(status, "ready") && canTransition("ready", "sent");
  if (!directToSent && !viaReady) {
    return NextResponse.json(
      { error: `Offerten kan inte skickas från status "${status}"`, reason: "invalid_status" },
      { status: 422 },
    );
  }

  // Gather customer-visible content + run the egress gate
  const [scenario, cfEntries, internalEntries] = await Promise.all([
    getLatestScenario(orgId, id),
    listCustomerFacingEntries(orgId, "solar"),
    listKbEntries(orgId, { visibility: "internal_only" }),
  ]);

  const result = (scenario?.results as SolarEngineResult | undefined) ?? null;
  const narrative = typeof quote.meta?.narrativeText === "string" ? quote.meta.narrativeText : "";

  const assembled = [narrative, ...cfEntries.map((e) => e.body)].join("\n\n");
  const egress = runEgressGate({ renderedText: assembled }, internalEntries);
  if (!egress.ok) {
    return NextResponse.json(
      { error: "Egress-grinden blockerade innehållet", reason: "egress_blocked", blockedReasons: egress.blockedReasons },
      { status: 422 },
    );
  }

  // Build a public signing link if the share feature is configured
  let acceptUrl: string | null = null;
  if (isShareConfigured()) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://mailmind.se";
    acceptUrl = `${base.replace(/\/$/, "")}/q/${createShareToken(orgId, id)}`;
  }

  // Build + send the email
  const orgName = account.organization.name ?? "Mailmind Solar";
  const quoteNumber = quote.number ?? id.slice(0, 8);
  const email = buildEmail({
    customerName: customer.name,
    orgName,
    quoteNumber,
    narrative,
    result,
    validUntil:   quote.validUntil,
    acceptUrl,
  });

  // Generate a PDF copy of the quote to attach (dependency-free renderer).
  const figures = result
    ? [
        { label: "Årsproduktion (år 1)", value: kwh(result.annualProductionKwhY1) },
        { label: "Årlig besparing (år 1)", value: sek(result.annualSavingsSekY1) },
        { label: "ROT-avdrag", value: sek(result.rotDeductionSek) },
        { label: "Nettokostnad efter ROT", value: sek(result.netSystemCostSek) },
        { label: "Återbetalningstid", value: `${fmt(result.paybackYears, 1)} år` },
      ]
    : [];
  const pdf = renderQuotePdf({
    orgName,
    quoteNumber,
    dateLabel:     new Date(quote.createdAt).toLocaleDateString("sv-SE"),
    customerName:  customer.name,
    customerEmail: customer.email,
    heading:       "Offert — Solcellsanläggning",
    narrative,
    figures,
    included:      cfEntries.slice(0, 6).map((e) => ({ title: e.title, body: e.body })),
    validLabel:    quote.validUntil ? `Offerten gäller till och med ${new Date(quote.validUntil).toLocaleDateString("sv-SE")}.` : null,
    footer:        orgName,
  });

  const sendResult = await sendEmail({
    to:      customer.email,
    subject: email.subject,
    text:    email.text,
    html:    email.html,
    attachments: [{ filename: `Offert-${quoteNumber}.pdf`, content: pdf }],
  });

  if (!sendResult.ok) {
    return NextResponse.json(
      { error: "E-post kunde inte skickas", reason: "email_failed", detail: sendResult.error },
      { status: 502 },
    );
  }

  // Persist a vertical-agnostic ROI summary into quote.meta so the public
  // /q/[token] view can render figures without importing the solar vertical.
  const roiSummary = result
    ? [
        { label: "Årsproduktion (år 1)", value: kwh(result.annualProductionKwhY1) },
        { label: "Årlig besparing (år 1)", value: sek(result.annualSavingsSekY1) },
        { label: "ROT-avdrag", value: sek(result.rotDeductionSek) },
        { label: "Nettokostnad efter ROT", value: sek(result.netSystemCostSek) },
        { label: "Återbetalningstid", value: `${fmt(result.paybackYears, 1)} år` },
      ]
    : [];
  await updateQuote(orgId, id, { meta: { ...(quote.meta ?? {}), roiSummary } }, account.user.id);

  // Advance status (→ ready if needed → sent), append workflow event
  if (viaReady) {
    await updateQuote(orgId, id, { status: "ready" }, account.user.id);
  }
  await updateQuote(orgId, id, { status: "sent" }, account.user.id);
  await appendWorkflowEvent(orgId, id, {
    fromStage:   status,
    toStage:     "sent",
    actorUserId: account.user.id,
    reason:      `Skickad till ${customer.email}`,
  });

  await writeAuditLog({
    organizationId: orgId,
    userId:         account.user.id,
    action:         "quote_sent",
    metadata:       { quoteId: id, to: customer.email, emailId: sendResult.id },
  });

  return NextResponse.json({ ok: true, status: "sent", emailId: sendResult.id });
}
