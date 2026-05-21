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
import { requireOrgAdmin } from "@/lib/app/rbac";
import { listCaseTypes } from "@/lib/app/threads";
import { sql } from "drizzle-orm";

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
  const guard = requireOrgAdmin(account);
  if (guard) return NextResponse.json(guard.body, { status: guard.status });

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
      .onConflictDoUpdate({
        target: [caseTypes.organizationId, caseTypes.slug],
        set: {
          label:          sql`excluded.label`,
          requiredFields: sql`excluded.required_fields`,
          routeToEmail:   sql`excluded.route_to_email`,
          isDefault:      sql`excluded.is_default`,
          sortOrder:      sql`excluded.sort_order`,
          slaHours:       sql`excluded.sla_hours`,
        },
      })
      .returning();
    return NextResponse.json({ caseType: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
