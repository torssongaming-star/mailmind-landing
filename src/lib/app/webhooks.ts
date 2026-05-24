/**
 * Webhook endpoint management and firing logic.
 */

import crypto from "crypto";
import { db, isDbConnected, webhookEndpoints, webhookDeliveries } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { safeFetch } from "@/lib/utils/safe-fetch";

export async function listWebhooks(organizationId: string) {
  if (!isDbConnected()) return [];
  return db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.organizationId, organizationId))
    .orderBy(webhookEndpoints.createdAt);
}

export async function createWebhook(
  organizationId: string,
  input: { url: string; caseTypeSlug: string; secret?: string }
) {
  if (!isDbConnected()) return null;
  const [row] = await db
    .insert(webhookEndpoints)
    .values({
      organizationId,
      url:          input.url,
      caseTypeSlug: input.caseTypeSlug || "*",
      secret:       input.secret ?? null,
      isActive:     true,
    })
    .returning();
  return row;
}

export async function deleteWebhook(organizationId: string, id: string) {
  if (!isDbConnected()) return;
  await db
    .delete(webhookEndpoints)
    .where(and(
      eq(webhookEndpoints.id, id),
      eq(webhookEndpoints.organizationId, organizationId),
    ));
}

export async function updateWebhookStatus(id: string, status: "ok" | "error") {
  if (!isDbConnected()) return;
  await db
    .update(webhookEndpoints)
    .set({ lastStatus: status, lastFiredAt: new Date(), updatedAt: new Date() })
    .where(eq(webhookEndpoints.id, id));
}

// Delays before each attempt: immediate, 5 s, 30 s.
const RETRY_DELAYS_MS = [0, 5_000, 30_000];

type DeliveryResult =
  | { ok: true;  statusCode: number; error: null }
  | { ok: false; statusCode: number | null; error: string };

async function deliverWithRetry(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<DeliveryResult> {
  let lastStatusCode: number | null = null;
  let lastError = "Unknown error";

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (RETRY_DELAYS_MS[attempt] > 0) {
      await new Promise<void>(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
    // SSRF-resistant fetch: blocks private IPs / localhost / metadata, forces
    // https, re-validates after redirects, caps response bytes + timeout.
    const result = await safeFetch(url, {
      method:    "POST",
      headers:   { ...headers, "Content-Type": "application/json" },
      body,
      timeoutMs: 5_000,
      maxBytes:  16_000,
    });
    if (result.ok) {
      lastStatusCode = result.status;
      if (result.status >= 200 && result.status < 300) {
        return { ok: true, statusCode: result.status, error: null };
      }
      lastError = `HTTP ${result.status}`;
    } else {
      // Permanent rejection (scheme/host blocked) — no point retrying.
      if (result.reason.startsWith("scheme_not_allowed") || result.reason.startsWith("host_blocked")) {
        return { ok: false, statusCode: null, error: result.reason };
      }
      lastError = result.reason;
    }
  }

  return { ok: false, statusCode: lastStatusCode, error: lastError };
}

/**
 * Signs a webhook payload with the org's secret using HMAC-SHA256.
 * Receivers verify: HMAC-SHA256(secret, payload) === X-Mailmind-Signature value.
 * Format follows the GitHub/Stripe convention: "sha256=<hex>".
 */
function signPayload(secret: string, payload: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

export async function fireWebhooksForThread(
  organizationId: string,
  thread: {
    id: string;
    caseTypeSlug: string | null;
    fromEmail: string;
    subject: string | null;
  }
) {
  if (!isDbConnected()) return;

  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(and(
      eq(webhookEndpoints.organizationId, organizationId),
      eq(webhookEndpoints.isActive, true),
    ));

  const matching = endpoints.filter(
    ep => ep.caseTypeSlug === "*" || ep.caseTypeSlug === thread.caseTypeSlug
  );

  if (matching.length === 0) return;

  const payload = JSON.stringify({
    threadId:     thread.id,
    caseTypeSlug: thread.caseTypeSlug,
    fromEmail:    thread.fromEmail,
    subject:      thread.subject,
    timestamp:    new Date().toISOString(),
  });

  await Promise.allSettled(
    matching.map(async ep => {
      const start = Date.now();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (ep.secret) {
        // HMAC-sign the payload — never send the raw secret over the wire.
        // Receiver verifies: HMAC-SHA256(their_secret, body) === this header value.
        headers["X-Mailmind-Signature"] = signPayload(ep.secret, payload);
      }

      const result = await deliverWithRetry(ep.url, headers, payload);

      await updateWebhookStatus(ep.id, result.ok ? "ok" : "error");

      if (!result.ok) {
        console.warn("[webhooks] delivery failed after all retries", {
          organizationId,
          webhookEndpointId: ep.id,
          statusCode:        result.statusCode,
          error:             result.error,
        });
      }

      // Best-effort delivery log — failure here must not break the fire loop.
      try {
        await db.insert(webhookDeliveries).values({
          endpointId:  ep.id,
          organizationId,
          threadId:    thread.id,
          statusCode:  result.statusCode,
          durationMs:  Date.now() - start,
          error:       result.error,
          status:      result.ok ? "delivered" : "failed",
        });
      } catch (logErr) {
        console.warn("[webhooks] failed to log delivery:", logErr);
      }
    })
  );
}

/**
 * Recent deliveries for an endpoint (most recent first).
 * Org-scoped so a leaked endpointId from one org can never read another's logs.
 */
export async function listRecentDeliveries(
  organizationId: string,
  endpointId: string,
  limit = 20,
) {
  if (!isDbConnected()) return [];
  return db
    .select()
    .from(webhookDeliveries)
    .where(and(
      eq(webhookDeliveries.endpointId, endpointId),
      eq(webhookDeliveries.organizationId, organizationId),
    ))
    .orderBy(desc(webhookDeliveries.sentAt))
    .limit(limit);
}
