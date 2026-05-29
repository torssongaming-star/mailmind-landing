/**
 * GET    /api/quoting/solar/properties/[id]  — fetch one property
 * PATCH  /api/quoting/solar/properties/[id]  — partial update
 * DELETE /api/quoting/solar/properties/[id]  — hard delete
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import {
  getProperty,
  updateProperty,
  deleteProperty,
} from "@/lib/solar/data/properties";

export const runtime = "nodejs";

// ── Shared schemas ────────────────────────────────────────────────────────────

const RoofSurfaceSchema = z.object({
  area:    z.number().positive(),
  tilt:    z.number().min(0).max(90),
  azimuth: z.number().min(0).max(360),
  shading: z.number().min(0).max(1),
  label:   z.string().optional(),
});

const PatchBody = z.object({
  customerId:   z.string().uuid().nullable().optional(),
  address: z.object({
    street:     z.string().optional(),
    city:       z.string().optional(),
    postalCode: z.string().optional(),
    country:    z.string().optional(),
  }).optional(),
  roofSurfaces: z.array(RoofSurfaceSchema).optional(),
});

// ── Auth helper ───────────────────────────────────────────────────────────────

async function requireSolar(userId: string) {
  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) return { error: "Account not provisioned", status: 400 } as const;
  if (!account.access.canUseApp) return { error: "App access blocked", status: 403 } as const;
  if (!hasProductAccess(account, "solar")) return { error: "Solar product not enabled", status: 403 } as const;
  return { account };
}

type RouteContext = { params: Promise<{ id: string }> };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = await requireSolar(userId);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;
  const property = await getProperty(check.account.organization!.id, id);
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ property });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = await requireSolar(userId);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = PatchBody.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid input", issues: body.error.issues }, { status: 400 });
  }

  const { id } = await params;
  const updated = await updateProperty(check.account.organization!.id, id, {
    customerId:   body.data.customerId  ?? undefined,
    address:      body.data.address,
    roofSurfaces: body.data.roofSurfaces,
  });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ property: updated });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = await requireSolar(userId);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;
  const deleted = await deleteProperty(check.account.organization!.id, id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(null, { status: 204 });
}
