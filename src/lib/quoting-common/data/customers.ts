/**
 * Quoting-common — customer data layer.
 *
 * All reads and writes are scoped by `organizationId` (Mailmind multi-tenant
 * invariant). No function in this file operates without an org predicate.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { quotingCustomers } from "@/lib/db/schema";
import type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "../domain/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Cast DB row to domain type (column names are already camelCase via Drizzle). */
function toCustomer(row: typeof quotingCustomers.$inferSelect): Customer {
  return {
    ...row,
    address:    (row.address as Customer["address"]) ?? null,
    meta:       (row.meta as Record<string, unknown>) ?? {},
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** True if a customer has been soft-archived (meta.archived flag). */
export function isArchived(c: Customer): boolean {
  return c.meta?.archived === true;
}

/**
 * List customers for an org, newest first. Archived customers are excluded
 * unless `includeArchived` is set. Archive is a soft flag on meta.archived —
 * customers are referenced by quotes (FK), so they are never hard-deleted.
 */
export async function listCustomers(
  orgId: string,
  opts?: { includeArchived?: boolean },
): Promise<Customer[]> {
  const rows = await db
    .select()
    .from(quotingCustomers)
    .where(eq(quotingCustomers.organizationId, orgId))
    .orderBy(quotingCustomers.createdAt);
  const all = rows.map(toCustomer);
  return opts?.includeArchived ? all : all.filter((c) => !isArchived(c));
}

/**
 * Soft-archive (or restore) a customer by toggling meta.archived.
 * Returns the updated customer, or null if not found in this org.
 */
export async function setCustomerArchived(
  orgId: string,
  id: string,
  archived: boolean,
): Promise<Customer | null> {
  const existing = await getCustomer(orgId, id);
  if (!existing) return null;
  const nextMeta = { ...(existing.meta ?? {}), archived };
  return updateCustomer(orgId, id, { meta: nextMeta });
}

/**
 * Get a single customer. Returns `null` if not found or wrong org.
 */
export async function getCustomer(orgId: string, id: string): Promise<Customer | null> {
  const rows = await db
    .select()
    .from(quotingCustomers)
    .where(
      and(
        eq(quotingCustomers.organizationId, orgId),
        eq(quotingCustomers.id, id),
      ),
    )
    .limit(1);
  return rows[0] ? toCustomer(rows[0]) : null;
}

/**
 * Create a new customer for an org.
 */
export async function createCustomer(
  orgId: string,
  input: CreateCustomerInput,
): Promise<Customer> {
  const rows = await db
    .insert(quotingCustomers)
    .values({
      organizationId: orgId,
      name:           input.name,
      orgNumber:      input.orgNumber ?? null,
      email:          input.email ?? null,
      phone:          input.phone ?? null,
      address:        input.address ?? null,
      meta:           input.meta ?? {},
    })
    .returning();
  return toCustomer(rows[0]);
}

/**
 * Update fields on an existing customer.
 * Returns `null` if the customer does not exist in this org.
 */
export async function updateCustomer(
  orgId: string,
  id: string,
  patch: UpdateCustomerInput,
): Promise<Customer | null> {
  const now = new Date();
  const rows = await db
    .update(quotingCustomers)
    .set({
      ...(patch.name      !== undefined && { name:      patch.name }),
      ...(patch.orgNumber !== undefined && { orgNumber: patch.orgNumber }),
      ...(patch.email     !== undefined && { email:     patch.email }),
      ...(patch.phone     !== undefined && { phone:     patch.phone }),
      ...(patch.address   !== undefined && { address:   patch.address }),
      ...(patch.meta      !== undefined && { meta:      patch.meta }),
      updatedAt: now,
    })
    .where(
      and(
        eq(quotingCustomers.organizationId, orgId),
        eq(quotingCustomers.id, id),
      ),
    )
    .returning();
  return rows[0] ? toCustomer(rows[0]) : null;
}
