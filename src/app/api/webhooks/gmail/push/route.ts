/**
 * POST /api/webhooks/gmail/push
 *
 * Receives Google Cloud Pub/Sub push notifications for Gmail inboxes.
 * Google calls this endpoint when a new message arrives in a watched mailbox.
 *
 * Setup required (one-time in Google Cloud):
 *   1. Enable Cloud Pub/Sub API
 *   2. Create a topic, e.g. "gmail-push"
 *   3. Grant gmail-api-push@system.gserviceaccount.com the "Pub/Sub Publisher" role on the topic
 *   4. Create a Push subscription → URL: https://mailmind.se/api/webhooks/gmail/push
 *   5. Set GMAIL_PUBSUB_TOPIC=projects/PROJECT_ID/topics/gmail-push in Vercel env
 *
 * Pub/Sub push message shape:
 *   { message: { data: "<base64({emailAddress, historyId})>", messageId, publishTime }, subscription }
 *
 * Flow:
 *   1. Decode data → get emailAddress + historyId
 *   2. Look up inbox by email
 *   3. Decrypt stored tokens, refresh if needed
 *   4. Call Gmail history.list since last stored historyId
 *   5. For each new message: fetch, parse, create thread+message, auto-triage
 *   6. Persist updated historyId + tokens
 */

import { NextRequest, NextResponse } from "next/server";
import {
  decryptTokens,
  encryptTokens,
  getValidAccessToken,
  listHistory,
  getAndParseMessage,
  type GmailInboxConfig,
} from "@/lib/app/gmail";
import {
  getInboxByEmail,
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

type PubSubMessage = {
  message: {
    data:        string; // base64
    messageId:   string;
    publishTime: string;
  };
  subscription: string;
};

type GmailPushData = {
  emailAddress: string;
  historyId:    number;
};

export async function POST(req: NextRequest) {
  // ── 1. Parse Pub/Sub envelope ──────────────────────────────────────────────
  let envelope: PubSubMessage;
  try {
    envelope = await req.json() as PubSubMessage;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  let pushData: GmailPushData;
  try {
    const decoded = Buffer.from(envelope.message.data, "base64").toString("utf8");
    pushData = JSON.parse(decoded) as GmailPushData;
  } catch {
    return NextResponse.json({ error: "bad data" }, { status: 400 });
  }

  const { emailAddress, historyId: newHistoryId } = pushData;
  console.log(`[gmail/push] notification for ${maskEmail(emailAddress)}, historyId=${newHistoryId}`);

  // ── 2. Look up inbox ───────────────────────────────────────────────────────
  const inbox = await getInboxByEmail(emailAddress);
  if (!inbox || inbox.provider !== "gmail") {
    return NextResponse.json({ ok: true, skipped: "no_inbox" });
  }

  const config = inbox.config as GmailInboxConfig | null;
  if (!config?.encryptedTokens) {
    console.error(`[gmail/push] inbox ${inbox.id} has no encrypted tokens`);
    return NextResponse.json({ ok: true, skipped: "no_tokens" });
  }

  // ── 2b. Stale-notification guard ──────────────────────────────────────────
  // Pub/Sub guarantees at-least-once delivery — skip if we've already
  // processed this historyId or newer.
  if (config.historyId && Number(newHistoryId) <= Number(config.historyId)) {
    console.log(`[gmail/push] stale historyId ${newHistoryId} <= stored ${config.historyId}, skipping`);
    return NextResponse.json({ ok: true, skipped: "stale_history_id" });
  }

  // ── 3. Decrypt + refresh tokens if needed ─────────────────────────────────
  let tokens = decryptTokens(config.encryptedTokens);
  const { token: accessToken, updated } = await getValidAccessToken(tokens).catch(err => {
    console.error("[gmail/push] token refresh failed:", err);
    return { token: null as unknown as string, updated: null };
  });

  if (!accessToken) {
    return NextResponse.json({ ok: true, skipped: "token_refresh_failed" });
  }

  if (updated) tokens = updated;

  // ── 4. Fetch history since last stored historyId ───────────────────────────
  const startHistoryId = config.historyId ?? String(newHistoryId);
  const { messages: newMessages, latestHistoryId } = await listHistory(
    accessToken,
    startHistoryId,
  ).catch(err => {
    console.error("[gmail/push] listHistory failed:", err);
    return { messages: [], latestHistoryId: String(newHistoryId) };
  });

  // ── 5. Process each new message ────────────────────────────────────────────
  for (const { id: gmailMsgId } of newMessages) {
    try {
      // Idempotency — skip if already stored
      const dup = await findMessageByExternalId(gmailMsgId);
      if (dup) continue;

      const parsed = await getAndParseMessage(accessToken, gmailMsgId);
      if (!parsed) continue;
      if (!parsed.bodyText) continue;

      // Skip messages sent by ourselves (avoid reply loops)
      if (parsed.fromEmail.toLowerCase() === emailAddress.toLowerCase()) continue;

      // Blocklist check
      const blocked = await isBlocked(inbox.organizationId, parsed.fromEmail);
      if (blocked) continue;

      // Threading: use Gmail threadId as externalThreadId for grouping
      const externalThreadId = parsed.gmailThreadId;

      let thread = await findThreadByExternalId(inbox.organizationId, externalThreadId);
      if (thread && (thread.status === "resolved" || thread.status === "escalated")) {
        thread = null;
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
      if (!thread) continue;

      const now = new Date();
      await appendMessage({
        threadId:          thread.id,
        role:              "customer",
        bodyText:          parsed.bodyText,
        bodyHtml:          null,
        externalMessageId: gmailMsgId,
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
          source:   "gmail_push",
        },
      });

      // Auto-triage (non-blocking — we don't await the result here to keep response fast,
      // but we do await to get draftId for logging)
      autoTriageNewMessage({
        organizationId: inbox.organizationId,
        threadId:       thread.id,
        newEmailBody:   parsed.bodyText,
      }).catch(err => console.error("[gmail/push] autoTriage failed:", err));

    } catch (err) {
      console.error(`[gmail/push] failed to process message ${gmailMsgId}:`, err);
    }
  }

  // ── 6. Persist updated historyId + tokens ─────────────────────────────────
  const updatedConfig: GmailInboxConfig = {
    ...config,
    historyId:       latestHistoryId,
    encryptedTokens: encryptTokens(tokens),
  };
  await updateInboxConfig(inbox.id, updatedConfig as Record<string, unknown>);

  // Always return 2xx — Pub/Sub retries on non-2xx
  return NextResponse.json({ ok: true, processed: newMessages.length });
}
