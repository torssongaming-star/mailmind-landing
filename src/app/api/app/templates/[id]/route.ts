/**
 * /api/app/templates/:id
 *
 * PATCH  — update a template
 * DELETE — remove a template
 * POST (with action=use) — increment use_count for analytics
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/app/entitlements";
import {
  updateTemplate,
  deleteTemplate,
  incrementTemplateUseCount,
  getTemplate,
} from "@/lib/app/notes";

export const runtime = "nodejs";

const PatchBody = z.object({
  title:    z.string().trim().min(1).max(255).optional(),
  slug:     z.string().regex(/^[a-z0-9_-]{1,100}$/).nullable().optional(),
  bodyText: z.string().trim().min(1).max(10_000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await updateTemplate({
    organizationId: account.organization.id,
    templateId:     id,
    patch:          parsed.data,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const { id } = await params;
  await deleteTemplate({ organizationId: account.organization.id, templateId: id });
  return NextResponse.json({ ok: true });
}

/** POST { action: "use" } — increments use_count and returns the template body. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body?.action !== "use") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const template = await getTemplate(account.organization.id, id);
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await incrementTemplateUseCount(account.organization.id, id);
  return NextResponse.json({ template });
}
