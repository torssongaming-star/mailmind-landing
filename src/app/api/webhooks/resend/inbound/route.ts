/**
 * POST /api/webhooks/resend/inbound
 *
 * Receives parsed inbound emails from Resend Inbound.
 * Configure in Resend:
 *   Dashboard → Receiving → Add Domain (`mail.mailmind.se`)
 *   Dashboard → Webhooks → Add Endpoint
 *     URL:    https://mailmind.se/api/webhooks/resend/inbound
 *     Events: email.received
 *
 * Two-stage processing — Resend's webhook only carries metadata (email_id,
 * from, to, subject, message_id, attachments). To get the body and headers
 * we GET https://api.resend.com/emails/receiving/{email_id}.
 *
 * Routing:
 *   1. Verify svix signature (RESEND_WEBHOOK_SECRET)
 *   2. Ignore non-`email.received` events (200 OK)
 *   3. Idempotency check on message_id BEFORE fetching the body
 *   4. Inbox lookup from `to[]` — if unknown, 200 OK without fetching body
 *   5. Blocklist check on `from` — if blocked, drop without fetching body
 *   6. Fetch full email via Received Emails API
 *   7. Thread by In-Reply-To / References, append, auto-triage
 *
 * The endpoint is authenticated by signature, so we don't need to be inside
 * the Clerk middleware. proxy.ts must continue to exclude /api/webhooks/*.
 */

import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
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

// ── Types from Resend ────────────────────────────────────────────────────────

type ResendInboundEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    message_id?: string;
    from?: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
  };
};

type ResendReceivedEmail = {
  id: string;
  subject?: string | null;
  from?: string;
  to?: string[];
  message_id?: string;
  text?: string | null;
  html?: string | null;
  headers?: Record<string, string | string[]>;
};

// ── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[inbound] RESEND_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Svix requires the RAW body for signature verification — do NOT parse first.
  const rawBody = await req.text();
  const headers = {
    "svix-id":        req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: ResendInboundEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(rawBody, headers) as ResendInboundEvent;
  } catch (err) {
    console.warn("[inbound] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Resend may send multiple event types on the same endpoint (e.g. delivered,
  // bounced). Only react to inbound.
  if (event.type !== "email.received") {
    return NextResponse.json({ status: "ignored", type: event.type });
  }

  const data = event.data ?? {};
  const emailId   = data.email_id;
  const messageId = data.message_id ?? null;
  const fromHdr   = data.from ?? "";
  const toList    = data.to ?? [];
  const subject   = data.subject ?? "";

  if (!emailId) {
    return NextResponse.json({ error: "Missing email_id" }, { status: 400 });
  }

  const fromEmail = extractEmail(fromHdr);
  const toEmail   = pickMailmindAddress(toList);
  if (!fromEmail || !toEmail) {
    console.warn("[inbound] could not extract from/to:", { fromHdr, toList });
    return NextResponse.json({ error: "Could not parse from/to" }, { status: 400 });
  }

  // Inbox lookup — bail early on unknown recipients, no body fetch needed.
  const inbox = await getInboxByEmail(toEmail);
  if (!inbox) {
    console.warn("[inbound] no inbox registered for", toEmail);
    return NextResponse.json({ status: "no_inbox", to: toEmail });
  }

  // Blocklist — drop blocked senders without fetching body.
  if (await isBlocked(inbox.organizationId, fromEmail)) {
    console.log(`[inbound] blocked sender ${fromEmail} — skipping`);
    return NextResponse.json({ ok: true, skipped: "blocked" });
  }

  // Idempotency on Message-ID (globally unique per RFC 5322). Cheaper than
  // fetching the body just to discover it's a duplicate.
  if (messageId) {
    const dup = await findMessageByExternalId(messageId);
    if (dup) {
      console.log(`[inbound] duplicate Message-ID ${messageId} — skipping`);
      return NextResponse.json({ status: "duplicate", existingMessageId: dup.id });
    }
  }

  // Fetch the parsed email body + headers.
  let received: ResendReceivedEmail;
  try {
    received = await fetchReceivedEmail(emailId);
  } catch (err) {
    console.error("[inbound] failed to fetch received email:", err);
    // Return 5xx so Resend retries — the email exists, we just couldn't read it.
    return NextResponse.json({ error: "Could not fetch email body" }, { status: 502 });
  }

  const bodyText = (received.text ?? "").trim();
  const bodyHtml = received.html ?? null;
  if (!bodyText && !bodyHtml) {
    console.warn("[inbound] email has no text or html body", emailId);
    return NextResponse.json({ status: "empty_body", emailId });
  }

  // Threading — pull In-Reply-To / References from the headers object.
  const inReplyTo    = pickHeader(received.headers, "in-reply-to");
  const referencesHd = pickHeader(received.headers, "references");
  const externalThreadId =
    (referencesHd ? referencesHd.split(/\s+/).filter(Boolean)[0] : null) ||
    inReplyTo ||
    messageId ||
    null;

  let thread = externalThreadId
    ? await findThreadByExternalId(inbox.organizationId, externalThreadId)
    : null;

  // Closed threads get a fresh one on next inbound (matches existing behaviour).
  if (thread && (thread.status === "resolved" || thread.status === "escalated")) {
    thread = null;
  }

  if (!thread) {
    thread = await createThread({
      organizationId:   inbox.organizationId,
      inboxId:          inbox.id,
      fromEmail,
      fromName:         extractName(fromHdr),
      subject:          subject || null,
      externalThreadId,
    });
    if (!thread) {
      return NextResponse.json({ error: "Could not create thread" }, { status: 500 });
    }
  }

  const now = new Date();
  await appendMessage({
    threadId:          thread.id,
    role:              "customer",
    bodyText:          bodyText || (bodyHtml ?? ""),
    bodyHtml,
    externalMessageId: messageId,
    sentAt:            now,
  });
  await updateThread(inbox.organizationId, thread.id, {
    lastMessageAt: now,
    status:        thread.status === "open" || thread.status === "waiting" ? "open" : thread.status,
  });

  await writeAuditLog({
    organizationId: inbox.organizationId,
    action:         "email_processed",
    metadata: {
      threadId: thread.id,
      from:     fromEmail,
      to:       toEmail,
      subject,
      source:   "resend_inbound",
      emailId,
    },
  });

  // Auto-triage — must await on Vercel serverless so the function doesn't
  // terminate before the AI call completes. The AI service has its own 15s
  // timeout, well under Resend's webhook timeout.
  const triageResult = await autoTriageNewMessage({
    organizationId: inbox.organizationId,
    threadId:       thread.id,
    newEmailBody:   bodyText || (bodyHtml ?? ""),
  });

  return NextResponse.json({
    status:   "ok",
    threadId: thread.id,
    draftId:  triageResult.ok ? triageResult.draftId : null,
    triage:   triageResult.ok ? "generated" : `skipped: ${triageResult.reason}`,
  });
}

// ── Resend API ───────────────────────────────────────────────────────────────

async function fetchReceivedEmail(emailId: string): Promise<ResendReceivedEmail> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");

  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${key}` },
    // Inbound bodies are static once stored — but cache at the edge would
    // poison retries on a different region. Always hit origin.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Resend GET /emails/receiving/${emailId} → ${res.status}`);
  }
  return (await res.json()) as ResendReceivedEmail;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Resend returns header keys in lowercase per their docs, but be defensive. */
function pickHeader(
  headers: Record<string, string | string[]> | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) {
      return Array.isArray(v) ? v[0] ?? null : v;
    }
  }
  return null;
}

function extractEmail(headerValue: string): string | null {
  if (!headerValue) return null;
  const m = headerValue.match(/<([^>]+)>/);
  if (m) return m[1].trim().toLowerCase();
  const trimmed = headerValue.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(trimmed) ? trimmed : null;
}

function pickMailmindAddress(recipients: string[]): string | null {
  for (const r of recipients) {
    const e = extractEmail(r);
    if (e && e.endsWith("@mail.mailmind.se")) return e;
  }
  return recipients.length > 0 ? extractEmail(recipients[0]) : null;
}

function extractName(headerValue: string): string | null {
  if (!headerValue) return null;
  const m = headerValue.match(/^"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : null;
}
