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

/** Extract the first email address from a header value like "Name <a@b.com>". */
function extractEmail(headerValue: string): string | null {
  if (!headerValue) return null;
  const match = headerValue.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  // Fallback: trust the whole field if it looks like an address
  const trimmed = headerValue.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(trimmed) ? trimmed : null;
}

/** Some SendGrid `to` headers list multiple recipients — pick the @mail.mailmind.se one. */
function pickMailmindAddress(toHeader: string): string | null {
  const candidates = toHeader.split(",").map(s => s.trim());
  for (const c of candidates) {
    const e = extractEmail(c);
    if (e && e.endsWith("@mail.mailmind.se")) return e;
  }
  // Fallback: first address
  return candidates.length > 0 ? extractEmail(candidates[0]) : null;
}

export async function POST(req: NextRequest) {
  let payload: Record<string, string>;
  try {
    payload = await readPayload(req);
  } catch (err) {
    console.error("[inbound] failed to parse payload:", err);
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const fromHeader     = payload.from ?? "";
  const toHeader       = payload.to ?? "";
  const subject        = payload.subject ?? "";
  // SendGrid provides plain text + HTML; prefer text. `email` is the raw MIME.
  const bodyText       = (payload.text ?? payload.body ?? "").trim();
  const messageHeaders = payload.headers ?? "";

  if (!toHeader || !bodyText) {
    return NextResponse.json({ error: "Missing required fields (to, body)" }, { status: 400 });
  }

  const fromEmail = extractEmail(fromHeader);
  const toEmail   = pickMailmindAddress(toHeader);

  if (!fromEmail || !toEmail) {
    console.warn("[inbound] could not extract from/to:", { fromHeader, toHeader });
    return NextResponse.json({ error: "Could not parse from/to addresses" }, { status: 400 });
  }

  // Resolve org from inbox
  const inbox = await getInboxByEmail(toEmail);
  if (!inbox) {
    console.warn("[inbound] no inbox registered for", toEmail);
    // Return 200 to prevent SendGrid retries (the email is "accepted" but not processed)
    return NextResponse.json({ status: "no_inbox", to: toEmail });
  }

  // Idempotency check — if SendGrid retries the same email (e.g. our handler
  // was slow), skip duplicate processing. We dedupe on Message-ID since that's
  // globally unique per RFC 5322. Also handles cases where the customer sends
  // the exact same email twice.
  const messageIdEarly = extractHeader(payload.headers ?? "", "Message-ID");
  if (messageIdEarly) {
    const dup = await findMessageByExternalId(messageIdEarly);
    if (dup) {
      console.log(`[inbound] duplicate Message-ID ${messageIdEarly} — skipping`);
      return NextResponse.json({ status: "duplicate", existingMessageId: dup.id });
    }
  }

  // Try to thread the email. SendGrid passes the Message-ID and References
  // headers in the `headers` field. Look for In-Reply-To first, then Message-ID.
  const messageId    = extractHeader(messageHeaders, "Message-ID");
  const inReplyTo    = extractHeader(messageHeaders, "In-Reply-To");
  const referencesHd = extractHeader(messageHeaders, "References");

  // Use the OLDEST reference id as the canonical thread id when available;
  // else the In-Reply-To; else the message id (= start of new thread).
  const externalThreadId =
    (referencesHd ? referencesHd.split(/\s+/).filter(Boolean)[0] : null) ||
    inReplyTo ||
    messageId ||
    null;

  let thread = externalThreadId
    ? await findThreadByExternalId(inbox.organizationId, externalThreadId)
    : null;

  // If matched thread is closed, start a new one (per Electron prototype's logic)
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

  // Append customer message
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

  // Fire-and-forget AI auto-triage. We DON'T await — webhook returns fast,
  // SendGrid doesn't retry on slow responses, and the human can review the
  // draft once it lands. If AI fails, the thread still exists for manual handling.
  //
  // In a Vercel serverless environment, we DO need to await so the function
  // doesn't terminate before the AI call completes. Use a sensible timeout via
  // the AI service's built-in 15s timeout.
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

// ── Helpers ──────────────────────────────────────────────────────────────────

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
