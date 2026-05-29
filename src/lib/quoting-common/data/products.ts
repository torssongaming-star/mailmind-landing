/**
 * Quoting-common — product catalog + price book data layer.
 *
 * All reads are scoped by `organizationId`. `cost` on products is an
 * internal-only field — never emit it in customer-facing output.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  quotingProducts,
  quotingPriceBooks,
  quotingPriceBookVersions,
} from "@/lib/db/schema";
import type { Product, PriceBook, PriceBookVersion } from "../domain/types";

// ── Products ──────────────────────────────────────────────────────────────────

/**
 * List active products for an org, optionally filtered to a specific vertical.
 */
export async function listProducts(
  orgId: string,
  opts?: { vertical?: string },
): Promise<Product[]> {
  const rows = await db
    .select()
    .from(quotingProducts)
    .where(eq(quotingProducts.organizationId, orgId))
    .orderBy(quotingProducts.name);

  const result = rows.map((r) => ({
    ...r,
    verticals: (r.verticals as string[]) ?? [],
    spec:      (r.spec as Record<string, unknown>) ?? null,
    cost:      r.cost ?? null,
  })) as Product[];

  if (opts?.vertical) {
    return result.filter((p) => p.verticals.includes(opts.vertical!));
  }
  return result;
}

/**
 * Get a single product. Returns `null` if not found or wrong org.
 */
export async function getProduct(orgId: string, id: string): Promise<Product | null> {
  const rows = await db
    .select()
    .from(quotingProducts)
    .where(
      and(
        eq(quotingProducts.organizationId, orgId),
        eq(quotingProducts.id, id),
      ),
    )
    .limit(1);

  if (!rows[0]) return null;
  const r = rows[0];
  return {
    ...r,
    verticals: (r.verticals as string[]) ?? [],
    spec:      (r.spec as Record<string, unknown>) ?? null,
    cost:      r.cost ?? null,
  } as Product;
}

// ── Price books ───────────────────────────────────────────────────────────────

/**
 * List all price books for an org.
 */
export async function listPriceBooks(orgId: string): Promise<PriceBook[]> {
  const rows = await db
    .select()
    .from(quotingPriceBooks)
    .where(eq(quotingPriceBooks.organizationId, orgId))
    .orderBy(quotingPriceBooks.name);

  return rows.map((r) => ({
    ...r,
    verticals: (r.verticals as string[]) ?? [],
  })) as PriceBook[];
}

/**
 * Get the latest published version for a price book.
 * Returns `null` if no published version exists.
 */
export async function getLatestPublishedVersion(
  orgId: string,
  priceBookId: string,
): Promise<PriceBookVersion | null> {
  const rows = await db
    .select()
    .from(quotingPriceBookVersions)
    .where(
      and(
        eq(quotingPriceBookVersions.organizationId, orgId),
        eq(quotingPriceBookVersions.priceBookId, priceBookId),
      ),
    )
    .orderBy(quotingPriceBookVersions.version)
    .limit(50); // take all, filter in JS for published (publishedAt IS NOT NULL)

  const published = rows.filter((r) => r.publishedAt !== null);
  if (!published.length) return null;

  // Highest version number among published
  const latest = published.sort((a, b) => b.version - a.version)[0];
  return {
    ...latest,
    effectiveFrom: latest.effectiveFrom,
    items:         (latest.items as PriceBookVersion["items"]) ?? {},
  } as PriceBookVersion;
}
