/**
 * GET  /api/quoting/kb        — list KB entries (member+)
 * POST /api/quoting/kb        — create KB entry (owner/admin only)
 *
 * Query params (GET): ?vertical=solar&visibility=customer_facing
 *
 * Lifecycle: auth → account → app-access → product-access → (admin gate) → zod → service
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount, hasProductAccess } from "@/lib/app/entitlements";
import { requireOrgAdmin } from "@/lib/app/rbac";
import { writeAuditLog } from "@/lib/app/audit";
import {
  listKbEntries,
  createKbEntry,
} from "@/lib/quoting-common/data/kb";

export const runtime = "nodejs";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (!account.access.canUseApp) {
    return NextResponse.json({ error: "App access blocked", reason: account.access.reason }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const vertical   = sp.get("vertical")   ?? undefined;
  const visibility = sp.get("visibility") ?? undefined;

  // Basic product gate — at least one quoting vertical must be enabled
  if (vertical && !hasProductAccess(account, vertical)) {
    return NextResponse.json({ error: "Product not enabled" }, { status: 403 });
  }

  const entries = await listKbEntries(account.organization.id, {
    vertical,
    visibility: visibility as "internal_only" | "customer_facing" | undefined,
  });

  return NextResponse.json({ entries });
}

// ── POST ──────────────────────────────────────────────────────────────────────

const PostBody = z.object({
  title:      z.string().trim().min(1).max(300),
  body:       z.string().trim().min(1),
  category:   z.enum(["faq", "policy", "spec", "caveat", "other"]).optional(),
  visibility: z.enum(["internal_only", "customer_facing"]).optional(),
  vertical:   z.string().max(50).optional(),
  source:     z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (!account.access.canUseApp) {
    return NextResponse.json({ error: "App access blocked", reason: account.access.reason }, { status: 403 });
  }

  // KB mutation requires owner/admin
  const adminCheck = requireOrgAdmin(account);
  if (adminCheck) return NextResponse.json(adminCheck.body, { status: adminCheck.status });

  const parsed = PostBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const entry = await createKbEntry(account.organization.id, {
    title:      parsed.data.title,
    body:       parsed.data.body,
    category:   parsed.data.category,
    visibility: parsed.data.visibility, // defaults to internal_only in data layer
    vertical:   parsed.data.vertical,
    source:     parsed.data.source,
    createdBy:  account.user.id,
  });

  await writeAuditLog({
    organizationId: account.organization.id,
    userId:         account.user.id,
    action:         "kb_entry_created",
    metadata:       { entryId: entry.id, visibility: entry.visibility, vertical: entry.vertical },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
