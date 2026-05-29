/**
 * Solar — properties data layer.
 *
 * Manages `solar_properties` rows (building site + roof surfaces).
 * All operations are scoped by `organizationId`.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { solarProperties } from "@/lib/db/schema";
import type { RoofSurface } from "@/lib/db/schema.solar";

// ── Input types ───────────────────────────────────────────────────────────────

export type PropertyAddress = {
  street?:     string;
  city?:       string;
  postalCode?: string;
  country?:    string;
};

export type CreatePropertyInput = {
  customerId?:   string;
  address?:      PropertyAddress;
  roofSurfaces?: RoofSurface[];
};

export type UpdatePropertyInput = Partial<CreatePropertyInput>;

export type SolarPropertyRow = typeof solarProperties.$inferSelect;

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listProperties(orgId: string): Promise<SolarPropertyRow[]> {
  return db
    .select()
    .from(solarProperties)
    .where(eq(solarProperties.organizationId, orgId))
    .orderBy(solarProperties.createdAt);
}

export async function getProperty(
  orgId: string,
  id:    string,
): Promise<SolarPropertyRow | null> {
  const rows = await db
    .select()
    .from(solarProperties)
    .where(
      and(
        eq(solarProperties.organizationId, orgId),
        eq(solarProperties.id, id),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createProperty(
  orgId: string,
  input: CreatePropertyInput,
): Promise<SolarPropertyRow> {
  const rows = await db
    .insert(solarProperties)
    .values({
      organizationId: orgId,
      customerId:     input.customerId   ?? null,
      address:        input.address      ?? null,
      roofSurfaces:   input.roofSurfaces ?? [],
    })
    .returning();
  return rows[0];
}

export async function updateProperty(
  orgId:  string,
  id:     string,
  patch:  UpdatePropertyInput,
): Promise<SolarPropertyRow | null> {
  const rows = await db
    .update(solarProperties)
    .set({
      ...(patch.customerId   !== undefined && { customerId:   patch.customerId }),
      ...(patch.address      !== undefined && { address:      patch.address }),
      ...(patch.roofSurfaces !== undefined && { roofSurfaces: patch.roofSurfaces }),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(solarProperties.organizationId, orgId),
        eq(solarProperties.id, id),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function deleteProperty(
  orgId: string,
  id:    string,
): Promise<boolean> {
  const rows = await db
    .delete(solarProperties)
    .where(
      and(
        eq(solarProperties.organizationId, orgId),
        eq(solarProperties.id, id),
      ),
    )
    .returning({ id: solarProperties.id });
  return rows.length > 0;
}
