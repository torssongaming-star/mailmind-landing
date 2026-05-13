/**
 * Webhook endpoint management and firing logic.
 */

import { db, isDbConnected, webhookEndpoints, webhookDeliveries } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";

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
      let statusCode: number | null = null;
      let errorMsg:   string | null = null;
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (ep.secret) headers["X-Mailmind-Secret"] = ep.secret;
        const res = await fetch(ep.url, { method: "POST", headers, body: payload });
        statusCode = res.status;
        if (!res.ok) errorMsg = `HTTP ${res.status}`;
        await updateWebhookStatus(ep.id, res.ok ? "ok" : "error");
      } catch (e) {
        errorMsg = e instanceof Error ? e.message : "Unknown error";
        await updateWebhookStatus(ep.id, "error");
      } finally {
        // Best-effort delivery log — failure here must not break the fire loop.
        try {
          await db.insert(webhookDeliveries).values({
            endpointId:     ep.id,
            organizationId,
            threadId:       thread.id,
            statusCode,
            durationMs:     Date.now() - start,
            error:          errorMsg,
          });
        } catch (logErr) {
          console.warn("[webhooks] failed to log delivery:", logErr);
        }
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
