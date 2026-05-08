/**
 * /api/app/case-types
 *
 * GET  — list case types for org
 * POST — create a new case type
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db, isDbConnected, caseTypes } from "@/lib/db";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listCaseTypes } from "@/lib/app/threads";

export const runtime = "nodejs";

const SLUG_PATTERN = /^[a-z0-9_]{1,100}$/;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const list = await listCaseTypes(account.organization.id);
  return NextResponse.json({ caseTypes: list });
}

const PostBody = z.object({
  slug:           z.string().regex(SLUG_PATTERN, "lowercase letters, numbers, underscore only"),
  label:          z.string().trim().min(1).max(255),
  requiredFields: z.array(z.string().trim().min(1)).max(20).default([]),
  routeToEmail:   z.string().email().nullable().optional(),
  isDefault:      z.boolean().optional(),
  sortOrder:      z.number().int().min(0).max(999).optional(),
  slaHours:       z.number().int().min(1).max(720).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", issues: parsed.error.issues }, { status: 400 });
  }

  if (!isDbConnected()) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }

  try {
    const [row] = await db
      .insert(caseTypes)
      .values({
        organizationId: account.organization.id,
        slug:           parsed.data.slug,
        label:          parsed.data.label,
        requiredFields: parsed.data.requiredFields,
        routeToEmail:   parsed.data.routeToEmail ?? null,
        isDefault:      parsed.data.isDefault ?? false,
        sortOrder:      parsed.data.sortOrder ?? 0,
        slaHours:       parsed.data.slaHours ?? null,
      })
      .returning();
    return NextResponse.json({ caseType: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return NextResponse.json({ error: "A case type with this slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
