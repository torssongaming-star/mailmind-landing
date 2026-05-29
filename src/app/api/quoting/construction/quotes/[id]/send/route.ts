/**
 * POST /api/quoting/construction/quotes/[id]/send
 *
 * Sends a construction quote to the customer by email and advances it to
 * `sent`. Mirrors the solar send route but reads display figures from
 * quote.meta.roiSummary (persisted by the construction calculate route).
 *
 * SECURITY: egress gate over the assembled customer-visible text before send.
 * Mutation requires owner/admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { requireOrgAdmin } from "@/lib/app/rbac";
import { getQuote, updateQuote, appendWorkflowEvent } from "@/lib/quoting-common/data/quotes";
import { getCustomer } from "@/lib/quoting-common/data/customers";
import { listKbEntries, listCustomerFacingEntries } from "@/lib/quoting-common/data/kb";
import { runEgressGate } from "@/lib/quoting-common/egress/gate";
import { canTransition } from "@/lib/quoting-common/domain/quote-state";
import { createShareToken, isShareConfigured } from "@/lib/quoting-common/sharing/token";
import { sendEmail } from "@/lib/app/email";
import { writeAuditLog } from "@/lib/app/audit";
import type { QuoteStatus } from "@/lib/quoting-common/domain/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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
  if (!hasProductAccess(account, "construction")) {
    return NextResponse.json({ error: "Construction product not enabled" }, { status: 403 });
  }

  const adminCheck = requireOrgAdmin(account);
  if (adminCheck) return NextResponse.json(adminCheck.body, { status: adminCheck.status });

  const orgId = account.organization.id;
  const quote = await getQuote(orgId, id);
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const customer = quote.customerId ? await getCustomer(orgId, quote.customerId) : null;
  if (!customer?.email) {
    return NextResponse.json(
      { error: "Kunden saknar e-postadress", reason: "customer_email_required" },
      { status: 422 },
    );
  }

  const status = quote.status as QuoteStatus;
  const directToSent = canTransition(status, "sent");
  const viaReady     = status !== "ready" && canTransition(status, "ready") && canTransition("ready", "sent");
  if (!directToSent && !viaReady) {
    return NextResponse.json(
      { error: `Offerten kan inte skickas från status "${status}"`, reason: "invalid_status" },
      { status: 422 },
    );
  }

  const [cfEntries, internalEntries] = await Promise.all([
    listCustomerFacingEntries(orgId, "construction"),
    listKbEntries(orgId, { visibility: "internal_only" }),
  ]);

  const narrative = typeof quote.meta?.narrativeText === "string" ? quote.meta.narrativeText : "";
  const figures = readFigures(quote.meta);

  const assembled = [narrative, ...cfEntries.map((e) => e.body)].join("\n\n");
  const egress = runEgressGate({ renderedText: assembled }, internalEntries);
  if (!egress.ok) {
    return NextResponse.json(
      { error: "Egress-grinden blockerade innehållet", reason: "egress_blocked", blockedReasons: egress.blockedReasons },
      { status: 422 },
    );
  }

  // Public signing link if configured
  let acceptUrl: string | null = null;
  if (isShareConfigured()) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://mailmind.se";
    acceptUrl = `${base.replace(/\/$/, "")}/q/${createShareToken(orgId, id)}`;
  }

  const orgName = account.organization.name ?? "Mailmind";
  const quoteNumber = quote.number ?? id.slice(0, 8);
  const subject = `Offert ${quoteNumber} — ${orgName}`;

  const textLines = [
    `Hej ${customer.name},`,
    "",
    narrative || "Tack för ditt intresse. Här kommer din offert.",
    "",
    ...(figures.length ? [...figures.map((f) => `  • ${f.label}: ${f.value}`), ""] : []),
    quote.validUntil ? `Offerten gäller till och med ${new Date(quote.validUntil).toLocaleDateString("sv-SE")}.` : "",
    acceptUrl ? `\nSe och acceptera offerten här:\n${acceptUrl}` : "",
    "",
    "Med vänliga hälsningar,",
    orgName,
  ].filter((l) => l !== undefined);

  const figureRows = figures
    .map((f) => `<tr><td style="padding:6px 0;color:#475569;">${f.label}</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a;">${f.value}</td></tr>`)
    .join("");

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
  <h2 style="font-size:18px;margin:0 0 4px;">Offert ${quoteNumber}</h2>
  <p style="color:#64748b;margin:0 0 20px;">${orgName}</p>
  <p>Hej ${customer.name},</p>
  ${narrative ? `<p style="line-height:1.6;white-space:pre-wrap;">${escapeHtml(narrative)}</p>` : `<p>Tack för ditt intresse. Här kommer din offert.</p>`}
  ${figures.length ? `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;"><tbody>${figureRows}</tbody></table>` : ""}
  ${quote.validUntil ? `<p style="color:#64748b;font-size:13px;">Offerten gäller till och med ${new Date(quote.validUntil).toLocaleDateString("sv-SE")}.</p>` : ""}
  ${acceptUrl ? `<p style="margin:24px 0;"><a href="${acceptUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Se och acceptera offerten</a></p>` : ""}
  <p style="margin-top:24px;">Med vänliga hälsningar,<br><strong>${orgName}</strong></p>
</div>`.trim();

  const sendResult = await sendEmail({ to: customer.email, subject, text: textLines.join("\n"), html });
  if (!sendResult.ok) {
    return NextResponse.json(
      { error: "E-post kunde inte skickas", reason: "email_failed", detail: sendResult.error },
      { status: 502 },
    );
  }

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
    metadata:       { quoteId: id, to: customer.email, emailId: sendResult.id, vertical: "construction" },
  });

  return NextResponse.json({ ok: true, status: "sent", emailId: sendResult.id });
}
