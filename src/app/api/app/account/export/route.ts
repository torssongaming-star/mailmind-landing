/**
 * GET /api/app/account/export
 *
 * GDPR data-export — returns a JSON blob with all data we hold for the user's
 * organisation. Only the owner can request the full org export.
 *
 * Response is streamed as `Content-Disposition: attachment` so the browser
 * downloads it as `mailmind-export-<date>.json`.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentAccount } from "@/lib/app/entitlements";
import {
  db, isDbConnected,
  organizations, users, emailThreads, emailMessages,
  aiDrafts, aiSettings, caseTypes, knowledgeEntries, replyTemplates,
  senderBlocklist, webhookEndpoints, inboxes, auditLogs,
  orgInvites, pushSubscriptions, subscriptions, licenseEntitlements, usageCounters,
} from "@/lib/db";
import { eq } from "drizzle-orm";
import { writeAuditLog } from "@/lib/app/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  if (!isDbConnected()) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (account.user.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can export org data" }, { status: 403 });
  }

  const orgId = account.organization.id;

  // Fetch everything scoped to this org in parallel
  const [
    org, usersList, threads, drafts, settings, caseTypeList, knowledge,
    templates, blocks, webhooks, inboxList, audit, invites, pushSubs,
    subs, entitlements, usage,
  ] = await Promise.all([
    db.select().from(organizations).where(eq(organizations.id, orgId)).then(r => r[0] ?? null),
    db.select().from(users).where(eq(users.organizationId, orgId)),
    db.select().from(emailThreads).where(eq(emailThreads.organizationId, orgId)),
    db.select().from(aiDrafts).where(eq(aiDrafts.organizationId, orgId)),
    db.select().from(aiSettings).where(eq(aiSettings.organizationId, orgId)).then(r => r[0] ?? null),
    db.select().from(caseTypes).where(eq(caseTypes.organizationId, orgId)),
    db.select().from(knowledgeEntries).where(eq(knowledgeEntries.organizationId, orgId)),
    db.select().from(replyTemplates).where(eq(replyTemplates.organizationId, orgId)),
    db.select().from(senderBlocklist).where(eq(senderBlocklist.organizationId, orgId)),
    db.select().from(webhookEndpoints).where(eq(webhookEndpoints.organizationId, orgId)),
    db.select().from(inboxes).where(eq(inboxes.organizationId, orgId)),
    db.select().from(auditLogs).where(eq(auditLogs.organizationId, orgId)),
    db.select().from(orgInvites).where(eq(orgInvites.organizationId, orgId)),
    db.select().from(pushSubscriptions).where(eq(pushSubscriptions.organizationId, orgId)),
    db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId)),
    db.select().from(licenseEntitlements).where(eq(licenseEntitlements.organizationId, orgId)),
    db.select().from(usageCounters).where(eq(usageCounters.organizationId, orgId)),
  ]);

  // Email messages — fetched per thread to keep relation intact
  const threadIds = threads.map(t => t.id);
  const messages = threadIds.length > 0
    ? await db.select().from(emailMessages).where(eq(emailMessages.threadId, threadIds[0])) // placeholder, expanded below
    : [];
  // For multiple threads we need an IN clause — Drizzle inArray
  const allMessages: typeof messages = [];
  for (const tid of threadIds) {
    const rows = await db.select().from(emailMessages).where(eq(emailMessages.threadId, tid));
    allMessages.push(...rows);
  }

  // Redact sensitive inbox config (encrypted tokens) — caller doesn't need them
  const safeInboxes = inboxList.map(i => {
    const cfg = i.config as Record<string, unknown> | null;
    const redacted = cfg ? { ...cfg, encryptedTokens: cfg.encryptedTokens ? "[REDACTED]" : undefined } : null;
    return { ...i, config: redacted };
  });

  // Redact push subscription keys (random crypto, not useful in export)
  const safePushSubs = pushSubs.map(p => ({ ...p, p256dh: "[REDACTED]", auth: "[REDACTED]" }));

  const payload = {
    exportedAt: new Date().toISOString(),
    organization: org,
    users: usersList,
    subscription: subs,
    entitlements: entitlements[0] ?? null,
    usage,
    aiSettings: settings,
    caseTypes: caseTypeList,
    knowledge,
    templates,
    blocklist: blocks,
    webhooks,
    inboxes: safeInboxes,
    invites,
    pushSubscriptions: safePushSubs,
    threads,
    messages: allMessages,
    drafts,
    auditLogs: audit,
  };

  await writeAuditLog({
    organizationId: orgId,
    userId:         account.user.id,
    action:         "data_export_requested",
    metadata:       { exportedAt: payload.exportedAt },
  });

  const filename = `mailmind-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type":        "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
