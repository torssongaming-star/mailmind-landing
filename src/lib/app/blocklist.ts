/**
 * Sender blocklist helpers.
 * Exact match: user@domain.com  OR domain match: @domain.com
 */

import { db, isDbConnected, senderBlocklist } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function listBlocklist(organizationId: string) {
  if (!isDbConnected()) return [];
  return db
    .select()
    .from(senderBlocklist)
    .where(eq(senderBlocklist.organizationId, organizationId))
    .orderBy(senderBlocklist.createdAt);
}

export async function addBlockEntry(organizationId: string, pattern: string, reason?: string) {
  if (!isDbConnected()) return null;
  const [row] = await db
    .insert(senderBlocklist)
    .values({ organizationId, pattern: pattern.toLowerCase().trim(), reason: reason ?? null })
    .returning();
  return row;
}

export async function removeBlockEntry(organizationId: string, entryId: string) {
  if (!isDbConnected()) return;
  await db
    .delete(senderBlocklist)
    .where(and(
      eq(senderBlocklist.id, entryId),
      eq(senderBlocklist.organizationId, organizationId),
    ));
}

export async function isBlocked(organizationId: string, fromEmail: string): Promise<boolean> {
  if (!isDbConnected()) return false;
  const email = fromEmail.toLowerCase().trim();
  const domain = "@" + email.split("@")[1];

  const entries = await db
    .select()
    .from(senderBlocklist)
    .where(eq(senderBlocklist.organizationId, organizationId));

  return entries.some(e => e.pattern === email || e.pattern === domain);
}
