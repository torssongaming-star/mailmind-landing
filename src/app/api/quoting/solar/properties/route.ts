/**
 * GET  /api/quoting/solar/properties      — list properties for the org
 * POST /api/quoting/solar/properties      — create a new property
 *
 * Individual property management:
 * GET    /api/quoting/solar/properties/[id]   — fetch one
 * PATCH  /api/quoting/solar/properties/[id]   — partial update
 * DELETE /api/quoting/solar/properties/[id]   — hard delete
 *
 * Lifecycle: auth → account → product-access('solar') → Zod → service
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { listProperties, createProperty } from "@/lib/solar/data/properties";

export const runtime = "nodejs";

// ── Shared schemas ────────────────────────────────────────────────────────────

const RoofSurfaceSchema = z.object({
  area:    z.number().positive(),
  tilt:    z.number().min(0).max(90),
  azimuth: z.number().min(0).max(360),
  shading: z.number().min(0).max(1),
  label:   z.string().optional(),
});

const AddressSchema = z.object({
  street:     z.string().optional(),
  city:       z.string().optional(),
  postalCode: z.string().optional(),
  country:    z.string().optional(),
}).optional();

// ── Auth helper ───────────────────────────────────────────────────────────────

async function requireSolarAccess(userId: string) {
  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) return { error: "Account not provisioned", status: 400 } as const;
  if (!account.access.canUseApp) return { error: "App access blocked", status: 403 } as const;
  if (!hasProductAccess(account, "solar")) return { error: "Solar product not enabled", status: 403 } as const;
  return { account };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = await requireSolarAccess(userId);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const properties = await listProperties(check.account.organization!.id);
  return NextResponse.json({ properties });
}

// ── POST ──────────────────────────────────────────────────────────────────────

const PostBody = z.object({
  customerId:   z.string().uuid().optional(),
  address:      AddressSchema,
  roofSurfaces: z.array(RoofSurfaceSchema).default([]),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = await requireSolarAccess(userId);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = PostBody.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid input", issues: body.error.issues }, { status: 400 });
  }

  const property = await createProperty(check.account.organization!.id, {
    customerId:   body.data.customerId,
    address:      body.data.address,
    roofSurfaces: body.data.roofSurfaces,
  });

  return NextResponse.json({ property }, { status: 201 });
}
