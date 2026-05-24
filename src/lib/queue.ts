/**
 * QStash queue wrapper for durable background jobs.
 *
 * Falls back to a fire-and-forget (caller-side after()) path when QSTASH_TOKEN
 * is unset (local dev / preview deploys without QStash configured) — the helper
 * simply returns `{ queued: false }` and the caller does the after() fallback.
 *
 * Why QStash: serverless after() has no retry, no observability, and Vercel
 * may freeze the function before our async work finishes. QStash gives us
 * durable HTTP delivery, automatic retries, dead-letter queue, and a dashboard
 * for inspecting failures.
 *
 * Pricing: 500 messages/day free, then $1 per 100k. Realistic year-1 usage
 * (50 customers × 20 emails/day) ≈ 30k/month → ~$0.30/month.
 */

import { Client } from "@upstash/qstash";
import type { BulkHeaders } from "@/lib/app/bulk-filter";

let _qstash: Client | null = null;
let _qstashChecked = false;

function getQStash(): Client | null {
  if (_qstashChecked) return _qstash;
  _qstashChecked = true;
  const token = process.env.QSTASH_TOKEN;
  if (!token) return null;
  _qstash = new Client({ token });
  return _qstash;
}

type EnqueueOptions = {
  /** Max retries on non-2xx response. Default 3. */
  retries?: number;
  /** Delay before first delivery, in seconds. Default 0 (immediate). */
  delaySeconds?: number;
};

export type EnqueueResult = { queued: boolean; messageId?: string };

/**
 * Enqueue an auto-triage job. Body shape:
 *   { organizationId, threadId, newEmailBody, bulkHeaders? }
 *
 * Returns `{ queued: true, messageId }` when QStash accepts the message,
 * `{ queued: false }` when QStash is not configured OR the publish call
 * threw (so the caller knows to use its after() fallback).
 */
export async function enqueueAutoTriage(
  payload: {
    organizationId: string;
    threadId:       string;
    newEmailBody:   string;
    bulkHeaders?:   BulkHeaders;
  },
  opts: EnqueueOptions = {},
): Promise<EnqueueResult> {
  const qstash = getQStash();
  if (!qstash) {
    return { queued: false };
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://mailmind.se";
  const url  = `${base}/api/jobs/triage`;

  try {
    const result = await qstash.publishJSON({
      url,
      body:    payload,
      retries: opts.retries ?? 3,
      delay:   opts.delaySeconds,
    });
    return { queued: true, messageId: result.messageId };
  } catch (err) {
    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(err, { tags: { component: "queue", op: "enqueue" } });
    } catch { /* ignore */ }
    console.error("[queue] enqueueAutoTriage failed:", err);
    return { queued: false };
  }
}
