/**
 * POST /api/webhooks/sendgrid/inbound
 *
 * Receives parsed inbound emails from SendGrid Inbound Parse.
 * Configure in SendGrid:
 *   Settings → Inbound Parse → Add Host & URL
 *   Hostname: mail.mailmind.se
 *   URL: https://mailmind.se/api/webhooks/sendgrid/inbound?token=<SENDGRID_INBOUND_SECRET>
 *   POST the raw, full MIME message: OFF (we want the parsed form)
 *
 * Auth:
 *   Shared-secret token in query parameter (see §1 in POST handler).
 *   Set SENDGRID_INBOUND_SECRET in Vercel; append the same value as ?token= to
 *   the URL above. SendGrid Inbound Parse does not support ECDSA signatures.
 *
 * Routing:
 *   1. Verify ?token= against SENDGRID_INBOUND_SECRET (constant-time)
 *   2. Extract `to` address from the form data
 *   3. Look up the matching inbox (globally unique email)
 *   4. Find or create thread (by external_thread_id if provided, else new)
 *   5. Append the customer message
 *   6. Auto-trigger AI draft via autoTriageNewMessage
 *
 * MUST be excluded from Clerk middleware (it is — proxy.ts only protects
 * /dashboard, /app, /api/billing, /api/app).
 */

import { NextRequest, NextResponse, after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import {
  getInboxByEmail,
  findThreadByExternalId,
  findMessageByExternalId,
  createThread,
  appendMessage,
  updateThread,
} from "@/lib/app/threads";
import { autoTriageNewMessage } from "@/lib/app/autoTriage";
import { writeAuditLog } from "@/lib/app/audit";
import { isBlocked } from "@/lib/app/blocklist";
import { isSystemSender } from "@/lib/app/system-senders";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { constantTimeEquals } from "@/lib/env";

export const runtime = "nodejs";

// SendGrid Inbound Parse uses multipart/form-data by default.
async function readForm(req: NextRequest): Promise<Record<string, string>> {
  const fd = await req.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/** Accept either multipart/form-data (SendGrid default) or JSON (for local testing). */
async function readPayload(req: NextRequest): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return (await req.json().catch(() => ({}))) as Record<string, string>;
  }
  return readForm(req);
}

/**
 * Decode RFC 2047 encoded-words, e.g.:
 *   =?utf-8?B?SMOkbGxv?=   (base64)
 *   =?iso-8859-1?Q?H=E4llo?= (quoted-printable)
 * Also handles plain ISO-8859-1 text by re-encoding via latin1 → utf-8.
 */
function decodeMimeWords(str: string): string {
  if (!str) return str;

  const decoded = str.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    (_, charset: string, encoding: string, text: string) => {
      try {
        if (encoding.toUpperCase() === "B") {
          const buf = Buffer.from(text, "base64");
          return buf.toString(charset.toLowerCase().replace("-", "") === "iso88591" ? "latin1" : "utf8");
        } else {
          const qp = text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (__, hex) =>
            String.fromCharCode(parseInt(hex, 16))
          );
          if (charset.toLowerCase().startsWith("iso")) {
            return Buffer.from(qp, "latin1").toString("utf8");
          }
          return qp;
        }
      } catch {
        return text;
      }
    }
  );

  return decoded;
}

function extractEmail(headerValue: string): string | null {
  if (!headerValue) return null;
  const match = headerValue.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  const trimmed = headerValue.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(trimmed) ? trimmed : null;
}

function pickMailmindAddress(toHeader: string): string | null {
  const candidates = toHeader.split(",").map(s => s.trim());
  for (const c of candidates) {
    const e = extractEmail(c);
    if (e && e.endsWith("@mail.mailmind.se")) return e;
  }
  return candidates.length > 0 ? extractEmail(candidates[0]) : null;
}

export async function POST(req: NextRequest) {
  // 1. Auth — shared-secret token in URL query parameter.
  //
  //    SendGrid Inbound Parse does NOT support ECDSA signatures (those belong
  //    to the Event Webhook product only). The `x-twilio-email-event-webhook-*`
  //    headers are never sent by the Inbound Parse service, so any ECDSA check
  //    here either silently passes (key unset) or rejects all real emails (key set).
  //
  //    Correct approach: append a random secret to the webhook URL in SendGrid:
  //      https://mailmind.se/api/webhooks/sendgrid/inbound?token=<secret>
  //    SendGrid preserves query parameters on POST, so the token travels with
  //    every request. Set SENDGRID_INBOUND_SECRET in Vercel to match.
  //
  //    Local dev: set ALLOW_UNSIGNED_INBOUND=1 (blocked in NODE_ENV=production).
  const secret   = process.env.SENDGRID_INBOUND_SECRET;
  const provided = req.nextUrl.searchParams.get("token");

  const allowUnsigned =
    process.env.ALLOW_UNSIGNED_INBOUND === "1" &&
    process.env.NODE_ENV !== "production";

  if (!secret) {
    if (!allowUnsigned) {
      console.error("[inbound] SENDGRID_INBOUND_SECRET not configured");
      return NextResponse.json({ error: "misconfigured" }, { status: 500 });
    }
  } else if (!constantTimeEquals(provided, secret)) {
    console.warn("[inbound] missing or invalid token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, string>;
  try {
    payload = await readPayload(req);
  } catch (err) {
    Sentry.captureException(err, { tags: { component: "webhook-sendgrid" } });
    console.error("[inbound] failed to parse payload:", err);
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const fromHeader     = decodeMimeWords(payload.from ?? "");
  const toHeader       = payload.to ?? "";
  const subject        = decodeMimeWords(payload.subject ?? "");
  const bodyText       = decodeMimeWords((payload.text ?? payload.body ?? "").trim());
  const messageHeaders = payload.headers ?? "";

  if (!toHeader || !bodyText) {
    return NextResponse.json({ error: "Missing required fields (to, body)" }, { status: 400 });
  }

  const fromEmail = extractEmail(fromHeader);
  const toEmail   = pickMailmindAddress(toHeader);

  if (!fromEmail || !toEmail) {
    console.warn("[inbound] could not extract from/to");
    return NextResponse.json({ error: "Could not parse from/to addresses" }, { status: 400 });
  }

  const inbox = await getInboxByEmail(toEmail);
  if (!inbox) {
    console.warn("[inbound] no inbox registered for masked address");
    return NextResponse.json({ status: "no_inbox" });
  }

  // Rate limit per inbox — defends against flood/loop attacks. Burst 600/min.
  if (!(await rateLimit(`inbound:sendgrid:${inbox.id}`, RATE_LIMITS.inboundWebhook))) {
    console.warn("[inbound] rate-limited inbox", inbox.id);
    return NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }

  // Skip Mailmind's own notification mail looping back via inbound parse.
  if (isSystemSender(fromEmail)) {
    return NextResponse.json({ ok: true, skipped: "system_sender" });
  }

  const blocked = await isBlocked(inbox.organizationId, fromEmail);
  if (blocked) {
    console.log("[inbound] blocked sender — skipping");
    return NextResponse.json({ ok: true, skipped: "blocked" });
  }

  const messageIdEarly = extractHeader(payload.headers ?? "", "Message-ID");
  if (messageIdEarly) {
    const dup = await findMessageByExternalId(messageIdEarly);
    if (dup) {
      console.log("[inbound] duplicate Message-ID — skipping");
      return NextResponse.json({ status: "duplicate", existingMessageId: dup.id });
    }
  }

  const messageId    = extractHeader(messageHeaders, "Message-ID");
  const inReplyTo    = extractHeader(messageHeaders, "In-Reply-To");
  const referencesHd = extractHeader(messageHeaders, "References");

  const externalThreadId =
    (referencesHd ? referencesHd.split(/\s+/).filter(Boolean)[0] : null) ||
    inReplyTo ||
    messageId ||
    null;

  let thread = externalThreadId
    ? await findThreadByExternalId(inbox.organizationId, externalThreadId)
    : null;

  if (thread && (thread.status === "resolved" || thread.status === "escalated")) {
    thread = null;
  }

  if (!thread) {
    thread = await createThread({
      organizationId:   inbox.organizationId,
      inboxId:          inbox.id,
      fromEmail,
      fromName:         extractName(fromHeader),
      subject:          subject || null,
      externalThreadId,
    });
    if (!thread) {
      return NextResponse.json({ error: "Could not create thread" }, { status: 500 });
    }
  }

  const now = new Date();
  await appendMessage({
    threadId:           thread.id,
    organizationId:     inbox.organizationId,
    role:               "customer",
    bodyText,
    bodyHtml:           payload.html ?? null,
    externalMessageId:  messageId,
    sentAt:             now,
  });
  await updateThread(inbox.organizationId, thread.id, {
    lastMessageAt: now,
    status:        thread.status === "open" || thread.status === "waiting" ? "open" : thread.status,
  });

  await writeAuditLog({
    organizationId: inbox.organizationId,
    action:         "email_processed",
    metadata: {
      threadId:  thread.id,
      from:      fromEmail,
      to:        toEmail,
      subject,
      source:    "sendgrid_inbound",
    },
  });

  // Use after() so we ack SendGrid immediately (avoid 30s timeout + duplicate
  // retries) while the Anthropic call continues on the warm lambda.
  after(() =>
    autoTriageNewMessage({
      organizationId: inbox.organizationId,
      threadId:       thread.id,
      newEmailBody:   bodyText,
    }).catch(err => {
      Sentry.captureException(err, { tags: { component: "webhook-sendgrid" } });
      console.error("[inbound] autoTriage failed", err);
    })
  );

  return NextResponse.json({ status: "ok", threadId: thread.id });
}

function extractHeader(headersBlob: string, name: string): string | null {
  if (!headersBlob) return null;
  const re = new RegExp(`^${name}:\\s*(.+)$`, "im");
  const m = headersBlob.match(re);
  return m ? m[1].trim() : null;
}

function extractName(headerValue: string): string | null {
  if (!headerValue) return null;
  const m = headerValue.match(/^"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : null;
}
