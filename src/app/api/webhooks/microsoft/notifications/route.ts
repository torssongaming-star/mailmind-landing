/**
 * POST /api/webhooks/microsoft/notifications
 *
 * Receives Microsoft Graph change notifications for Outlook inboxes.
 * Microsoft calls this endpoint when a new message arrives in a watched mailbox.
 *
 * Microsoft Graph subscription notes:
 *   - Subscriptions expire after max 4320 minutes (3 days) for mail resources.
 *   - The daily cron tick renews subscriptions expiring within 24h.
 *   - On first subscription creation, Microsoft sends a GET with ?validationToken=
 *     to verify the endpoint — we echo it back as plain text.
 *   - Subsequent POSTs carry notification payloads (one or many).
 *
 * Setup required (one-time in Azure Portal):
 *   1. Register app + add Mail.Read, Mail.Send, User.Read delegated permissions
 *   2. Set OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_ENCRYPT_KEY in Vercel
 *
 * Flow:
 *   1. Handle validation challenge (GET or POST with validationToken in query)
 *   2. For each notification: look up inbox by subscriptionId
 *   3. Decrypt tokens, refresh if needed
 *   4. Fetch and parse the new message from Graph
 *   5. Create thread + message, run auto-triage
 *   6. Persist updated tokens
 */

import { NextRequest, NextResponse } from "next/server";
import {
  decryptTokens,
  encryptTokens,
  getValidAccessToken,
  getAndParseMessage,
  type OutlookInboxConfig,
} from "@/lib/app/outlook";
import {
  getInboxBySubscriptionId,
  findThreadByExternalId,
  findMessageByExternalId,
  createThread,
  appendMessage,
  updateThread,
  updateInboxConfig,
} from "@/lib/app/threads";
import { autoTriageNewMessage } from "@/lib/app/autoTriage";
import { writeAuditLog } from "@/lib/app/audit";
import { isBlocked } from "@/lib/app/blocklist";
import { maskEmail } from "@/lib/utils";

export const runtime = "nodejs";

type GraphNotificationValue = {
  subscriptionId:               string;
  changeType:                   string;
  resourceData?: {
    id?: string;
    "@odata.type"?: string;
  };
  clientState?: string;
};

type GraphNotificationBody = {
  value: GraphNotificationValue[];
};

// ── GET — Microsoft validation challenge ────────────────────────────────────
// Microsoft sends GET /...?validationToken=<token> when creating a subscription.
// We must respond with the raw token as plain text, 200.
export async function GET(req: NextRequest) {
  const validationToken = new URL(req.url).searchParams.get("validationToken");
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ ok: true });
}

// ── POST — incoming notifications ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Microsoft sometimes also sends validation via POST when renewing subscriptions
  const validationToken = new URL(req.url).searchParams.get("validationToken");
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  let body: GraphNotificationBody;
  try {
    body = await req.json() as GraphNotificationBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  if (!Array.isArray(body.value) || body.value.length === 0) {
    return NextResponse.json({ ok: true, skipped: "empty" });
  }

  // Process each notification (Microsoft can batch multiple in one POST)
  for (const notification of body.value) {
    try {
      await processNotification(notification);
    } catch (err) {
      console.error("[microsoft/notifications] unhandled error:", err);
    }
  }

  // Always return 202 — Microsoft retries on non-2xx
  return new Response(null, { status: 202 });
}

async function processNotification(notification: GraphNotificationValue) {
  if (notification.changeType !== "created") return;
  if (notification.resourceData?.["@odata.type"] !== "#Microsoft.Graph.Message") return;

  const graphMessageId = notification.resourceData?.id;
  if (!graphMessageId) return;

  // ── 1. Look up inbox by subscription ──────────────────────────────────────
  const inbox = await getInboxBySubscriptionId(notification.subscriptionId);
  if (!inbox || inbox.provider !== "outlook") {
    console.warn(`[microsoft/notifications] no inbox for subscriptionId=${notification.subscriptionId}`);
    return;
  }

  const config = inbox.config as OutlookInboxConfig | null;
  if (!config?.encryptedTokens) {
    console.error(`[microsoft/notifications] inbox ${inbox.id} has no encrypted tokens`);
    return;
  }

  // ── 2. Decrypt + refresh tokens ───────────────────────────────────────────
  let tokens = decryptTokens(config.encryptedTokens);
  const { token: accessToken, updated } = await getValidAccessToken(tokens).catch(err => {
    console.error("[microsoft/notifications] token refresh failed:", err);
    return { token: null as unknown as string, updated: null };
  });

  if (!accessToken) return;
  if (updated) tokens = updated;

  // ── 3. Idempotency — skip if already stored ───────────────────────────────
  const dup = await findMessageByExternalId(graphMessageId);
  if (dup) return;

  // ── 4. Fetch + parse message ──────────────────────────────────────────────
  const parsed = await getAndParseMessage(accessToken, graphMessageId);
  if (!parsed || !parsed.bodyText) return;

  // Skip messages sent by ourselves (avoid reply loops)
  if (parsed.fromEmail === inbox.email.toLowerCase()) return;

  // Blocklist check
  const blocked = await isBlocked(inbox.organizationId, parsed.fromEmail);
  if (blocked) return;

  console.log(`[microsoft/notifications] new message for ${maskEmail(inbox.email)}, subject="${parsed.subject}"`);

  // ── 5. Thread + message persistence ──────────────────────────────────────
  const externalThreadId = parsed.conversationId;
  let thread = await findThreadByExternalId(inbox.organizationId, externalThreadId);
  if (thread && (thread.status === "resolved" || thread.status === "escalated")) {
    thread = null; // Start fresh on closed threads
  }

  if (!thread) {
    thread = await createThread({
      organizationId:   inbox.organizationId,
      inboxId:          inbox.id,
      fromEmail:        parsed.fromEmail,
      fromName:         parsed.fromName,
      subject:          parsed.subject,
      externalThreadId,
    });
  }
  if (!thread) return;

  const now = new Date();
  await appendMessage({
    threadId:          thread.id,
    role:              "customer",
    bodyText:          parsed.bodyText,
    bodyHtml:          null,
    externalMessageId: graphMessageId,
    sentAt:            now,
  });
  await updateThread(inbox.organizationId, thread.id, {
    lastMessageAt: now,
    status: thread.status === "open" || thread.status === "waiting" ? "open" : thread.status,
  });

  await writeAuditLog({
    organizationId: inbox.organizationId,
    action:         "email_processed",
    metadata: {
      threadId: thread.id,
      from:     parsed.fromEmail,
      subject:  parsed.subject,
      source:   "outlook_push",
    },
  });

  // ── 6. Auto-triage (fire-and-forget) ──────────────────────────────────────
  autoTriageNewMessage({
    organizationId: inbox.organizationId,
    threadId:       thread.id,
    newEmailBody:   parsed.bodyText,
  }).catch(err => console.error("[microsoft/notifications] autoTriage failed:", err));

  // ── 7. Persist updated tokens ─────────────────────────────────────────────
  await updateInboxConfig(inbox.id, {
    ...config,
    encryptedTokens: encryptTokens(tokens),
  } as Record<string, unknown>);
}
