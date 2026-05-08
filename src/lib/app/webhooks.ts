/**
 * Webhook endpoint management and firing logic.
 */

import { db, isDbConnected, webhookEndpoints } from "@/lib/db";
import { eq, and } from "drizzle-orm";

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
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (ep.secret) headers["X-Mailmind-Secret"] = ep.secret;
        const res = await fetch(ep.url, { method: "POST", headers, body: payload });
        await updateWebhookStatus(ep.id, res.ok ? "ok" : "error");
      } catch {
        await updateWebhookStatus(ep.id, "error");
      }
    })
  );
}
