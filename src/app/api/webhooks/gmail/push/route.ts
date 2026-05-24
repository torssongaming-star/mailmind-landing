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

import { NextRequest, NextResponse, after } from "next/server";
import {
  decryptTokens,
  encryptTokens,
  refreshAccessToken,
  listHistory,
  getAndParseMessage,
  type GmailInboxConfig,
} from "@/lib/app/gmail";
import { getValidAccessTokenLocked } from "@/lib/app/inbox-token-refresh";
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
import { isSystemSender } from "@/lib/app/system-senders";
import { maskEmail } from "@/lib/utils";
import { verifyGoogleOidcJwt } from "@/lib/app/google-oidc";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createLogger } from "@/lib/log";
import { requireInProduction } from "@/lib/env";

const log = createLogger("gmail/push");

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
  // ── 0. Authenticate Google (strategi-revision P2.4) ───────────────────────
  // In prod: require OIDC JWT signed by Google for the configured audience.
  // In non-prod with ALLOW_UNSIGNED_PUBSUB=1, skip auth for local testing.
  const expectedAudience = requireInProduction("GMAIL_PUSH_OIDC_AUDIENCE")
    ?? process.env.GMAIL_PUSH_OIDC_AUDIENCE;
  const allowUnsigned =
    process.env.ALLOW_UNSIGNED_PUBSUB === "1" &&
    process.env.NODE_ENV !== "production";

  if (!expectedAudience) {
    if (!allowUnsigned) {
      log.error("GMAIL_PUSH_OIDC_AUDIENCE not configured");
      return NextResponse.json({ error: "misconfigured" }, { status: 500 });
    }
    log.warn("ALLOW_UNSIGNED_PUBSUB active — skipping JWT auth (dev only)");
  } else {
    const authHeader = req.headers.get("authorization") ?? "";
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) {
      log.warn("missing Bearer token — rejected");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await verifyGoogleOidcJwt(
      m[1],
      expectedAudience,
      process.env.GMAIL_PUSH_SERVICE_ACCOUNT, // optional service-account pinning
    );
    if (!result.ok) {
      log.warn("JWT verify failed", { reason: result.reason });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    log.info("JWT accepted", { sub: result.payload.sub ?? "unknown" });
  }

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
  log.info("notification received", { email: maskEmail(emailAddress), historyId: newHistoryId });

  // ── 2. Look up inbox ───────────────────────────────────────────────────────
  const inbox = await getInboxByEmail(emailAddress);
  if (!inbox || inbox.provider !== "gmail") {
    return NextResponse.json({ ok: true, skipped: "no_inbox" });
  }

  // Per-inbox rate limit (defense-in-depth)
  if (!(await rateLimit(`inbound:gmail:${inbox.id}`, RATE_LIMITS.inboundWebhook))) {
    log.warn("rate-limited", { inboxId: inbox.id });
    return NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }

  const config = inbox.config as GmailInboxConfig | null;
  if (!config?.encryptedTokens) {
    log.error("inbox has no encrypted tokens", { inboxId: inbox.id });
    return NextResponse.json({ ok: true, skipped: "no_tokens" });
  }

  // ── 2b. Stale-notification guard ──────────────────────────────────────────
  // Pub/Sub guarantees at-least-once delivery — skip if we've already
  // processed this historyId or newer.
  if (config.historyId && Number(newHistoryId) <= Number(config.historyId)) {
    log.info("stale historyId — skipping", { newHistoryId, stored: config.historyId });
    return NextResponse.json({ ok: true, skipped: "stale_history_id" });
  }

  // ── 3. Decrypt + refresh tokens if needed ─────────────────────────────────
  // Locked per-inbox refresh — prevents concurrent Pub/Sub deliveries from
  // racing on Google's refresh_token endpoint. Helper persists fresh tokens
  // internally inside the lock; we receive them back for the final write.
  const refreshResult = await getValidAccessTokenLocked(inbox.id, config, {
    decrypt: decryptTokens,
    encrypt: encryptTokens,
    refresh: refreshAccessToken,
  }).catch(err => {
    log.error("token refresh failed", { error: String(err) });
    return null;
  });

  if (!refreshResult) {
    return NextResponse.json({ ok: true, skipped: "token_refresh_failed" });
  }
  const { accessToken, tokens } = refreshResult;

  // ── 4. Fetch history since last stored historyId ───────────────────────────
  const startHistoryId = config.historyId ?? String(newHistoryId);
  const { messages: newMessages, latestHistoryId } = await listHistory(
    accessToken,
    startHistoryId,
  ).catch(err => {
    log.error("listHistory failed", { error: String(err) });
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

      // Skip Mailmind's own notification mail looping back via the user's
      // connected inbox — these are pure noise and can't be acted on.
      if (isSystemSender(parsed.fromEmail)) continue;

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
        organizationId:    inbox.organizationId,
        role:              "customer",
        bodyText:          parsed.bodyText,
        bodyHtml:          parsed.bodyHtml,
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

      // Auto-triage: use after() so the serverless function stays alive until
      // the Anthropic call completes, even after the 200 response is sent.
      // Without after(), Vercel may freeze the execution context mid-generation.
      after(() =>
        autoTriageNewMessage({
          organizationId: inbox.organizationId,
          threadId:       thread.id,
          newEmailBody:   parsed.bodyText,
          bulkHeaders:    parsed.bulkHeaders,
        }).catch(err => log.error("autoTriage failed", { error: String(err) }))
      );

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
