/**
 * POST /api/webhooks/sendgrid/inbound
 *
 * Receives parsed inbound emails from SendGrid Inbound Parse.
 * Configure in SendGrid:
 *   Settings → Inbound Parse → Add Host & URL
 *   Hostname: mail.mailmind.se
 *   URL: https://mailmind.se/api/webhooks/sendgrid/inbound
 *   POST the raw, full MIME message: OFF (we want the parsed form)
 *
 * Routing:
 *   1. Extract `to` address from the form data
 *   2. Look up the matching inbox (globally unique email)
 *   3. Find or create thread (by external_thread_id if provided, else new)
 *   4. Append the customer message
 *   5. Auto-trigger AI draft via autoTriageNewMessage
 *
 * The endpoint is intentionally unauthenticated (SendGrid doesn't sign these
 * by default). We rely on:
 *   - Address ownership: only emails to known inboxes route to an org
 *   - Optional shared secret in URL or X-Mailmind-Secret header (TODO)
 *
 * MUST be excluded from Clerk middleware (it is — proxy.ts only protects
 * /dashboard, /app, /api/billing, /api/app).
 */

import { NextRequest, NextResponse } from "next/server";
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

import crypto from "crypto";

function verifySendGridSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  payload: string
): boolean {
  try {
    const verifier = crypto.createVerify("sha256");
    verifier.update(timestamp + payload);
    const key = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;
    return verifier.verify(key, signature, "base64");
  } catch (err) {
    console.error("[inbound] signature verification error:", err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  // 1. Signature Verification (Fas 12.1)
  const publicKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
  const signature = req.headers.get("x-twilio-email-event-webhook-signature");
  const timestamp = req.headers.get("x-twilio-email-event-webhook-timestamp");

  if (publicKey) {
    if (!signature || !timestamp) {
      console.warn("[inbound] missing signature or timestamp headers");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await req.clone().text();
    const isValid = verifySendGridSignature(publicKey, signature, timestamp, rawBody);

    if (!isValid) {
      console.warn("[inbound] invalid signature");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    // Fallback to secret token in URL if HMAC is not configured (Alternative from task)
    const secret = process.env.SENDGRID_INBOUND_SECRET;
    if (secret) {
      const url = new URL(req.url);
      const providedSecret = url.searchParams.get("secret");
      if (providedSecret !== secret) {
        console.warn("[inbound] invalid secret token");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
  }

  let payload: Record<string, string>;
  try {
    payload = await readPayload(req);
  } catch (err) {
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

  const triageResult = await autoTriageNewMessage({
    organizationId: inbox.organizationId,
    threadId:       thread.id,
    newEmailBody:   bodyText,
  });

  return NextResponse.json({
    status:  "ok",
    threadId: thread.id,
    draftId:  triageResult.ok ? triageResult.draftId : null,
    triage:   triageResult.ok ? "generated" : `skipped: ${triageResult.reason}`,
  });
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
