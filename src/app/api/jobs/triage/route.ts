/**
 * POST /api/jobs/triage
 *
 * QStash-delivered auto-triage job. Verifies the Upstash signature, then runs
 * autoTriageNewMessage. On non-2xx, QStash retries with exponential backoff
 * and ultimately routes to the dead-letter queue.
 *
 * Why not just /api/webhooks/...: this endpoint is the QStash *consumer*. It
 * receives our own payloads (enqueued from webhook handlers) after QStash
 * delivers them — that decouples the AI call from the inbound webhook's
 * response budget and gives us retries + observability.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import * as Sentry from "@sentry/nextjs";
import { autoTriageNewMessage } from "@/lib/app/autoTriage";
import { createLogger } from "@/lib/log";
import type { BulkHeaders } from "@/lib/app/bulk-filter";

const log = createLogger("jobs/triage");

export const runtime = "nodejs";
export const maxDuration = 60; // give the AI call room (15s call + retries)
export const dynamic = "force-dynamic";

type JobPayload = {
  organizationId: string;
  threadId:       string;
  newEmailBody:   string;
  bulkHeaders?:   BulkHeaders;
};

async function handler(req: NextRequest): Promise<Response> {
  let payload: JobPayload;
  try {
    payload = (await req.json()) as JobPayload;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  if (
    !payload.organizationId ||
    !payload.threadId ||
    typeof payload.newEmailBody !== "string"
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  try {
    const result = await autoTriageNewMessage(payload);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: "job-triage", organizationId: payload.organizationId },
    });
    log.error("triage failed", { error: String(err), threadId: payload.threadId });
    // Re-throw via 500 so QStash retries with backoff.
    return NextResponse.json({ error: "triage failed" }, { status: 500 });
  }
}

// verifySignatureAppRouter wraps the handler to check the `Upstash-Signature`
// header against QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY.
// When neither key is set (local dev without QStash), skip the wrapper so the
// route is still callable for direct tests — at that point enqueueAutoTriage()
// also returns { queued: false } so nothing in real flows hits this branch.
export const POST: (req: NextRequest) => Promise<Response> =
  process.env.QSTASH_CURRENT_SIGNING_KEY || process.env.QSTASH_NEXT_SIGNING_KEY
    ? (verifySignatureAppRouter(handler) as (req: NextRequest) => Promise<Response>)
    : handler;
