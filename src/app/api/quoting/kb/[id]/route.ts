/**
 * GET    /api/quoting/kb/[id]  — fetch one KB entry (member+)
 * PATCH  /api/quoting/kb/[id]  — partial update (owner/admin only)
 * DELETE /api/quoting/kb/[id]  — hard delete (owner/admin only)
 *
 * PATCH: if visibility changes from internal_only → customer_facing,
 * an audit log entry is written (kb_entry_promoted).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { requireOrgAdmin } from "@/lib/app/rbac";
import { writeAuditLog } from "@/lib/app/audit";
import {
  getKbEntry,
  updateKbEntry,
  deleteKbEntry,
} from "@/lib/quoting-common/data/kb";

export const runtime = "nodejs";

const PatchBody = z.object({
  title:      z.string().trim().min(1).max(300).optional(),
  body:       z.string().trim().min(1).optional(),
  category:   z.enum(["faq", "policy", "spec", "caveat", "other"]).optional(),
  visibility: z.enum(["internal_only", "customer_facing"]).optional(),
  vertical:   z.string().max(50).optional(),
  source:     z.string().max(200).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// ── Auth helper ───────────────────────────────────────────────────────────────

async function requireAuth(userId: string) {
  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) return { error: "Account not provisioned", status: 400 } as const;
  if (!account.access.canUseApp) return { error: "App access blocked", status: 403 } as const;
  return { account };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = await requireAuth(userId);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;
  const entry = await getKbEntry(check.account.organization!.id, id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ entry });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = await requireAuth(userId);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const adminCheck = requireOrgAdmin(check.account);
  if (adminCheck) return NextResponse.json(adminCheck.body, { status: adminCheck.status });

  const parsed = PatchBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await params;
  const orgId = check.account.organization!.id;

  // Read current entry to detect visibility promotion
  const before = await getKbEntry(orgId, id);
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await updateKbEntry(orgId, id, parsed.data);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Audit-log visibility promotion: internal_only → customer_facing
  if (
    before.visibility === "internal_only" &&
    updated.visibility === "customer_facing"
  ) {
    await writeAuditLog({
      organizationId: orgId,
      userId:         check.account.user!.id,
      action:         "kb_entry_promoted",
      metadata:       { entryId: id, title: updated.title, vertical: updated.vertical },
    });
  }

  return NextResponse.json({ entry: updated });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = await requireAuth(userId);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const adminCheck = requireOrgAdmin(check.account);
  if (adminCheck) return NextResponse.json(adminCheck.body, { status: adminCheck.status });

  const { id } = await params;
  const orgId = check.account.organization!.id;

  const deleted = await deleteKbEntry(orgId, id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await writeAuditLog({
    organizationId: orgId,
    userId:         check.account.user!.id,
    action:         "kb_entry_deleted",
    metadata:       { entryId: id },
  });

  return new NextResponse(null, { status: 204 });
}
