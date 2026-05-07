/**
 * /api/app/templates
 *
 * GET  — list reply templates for the user's org (most-used first)
 * POST — create a new template
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listTemplates, createTemplate } from "@/lib/app/notes";

export const runtime = "nodejs";

const SLUG_PATTERN = /^[a-z0-9_-]{1,100}$/;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const templates = await listTemplates(account.organization.id);
  return NextResponse.json({ templates });
}

const Body = z.object({
  title:    z.string().trim().min(1).max(255),
  slug:     z.string().regex(SLUG_PATTERN, "lowercase, digits, hyphens, underscore").optional(),
  bodyText: z.string().trim().min(1).max(10_000),
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

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const template = await createTemplate({
      organizationId: account.organization.id,
      title:          parsed.data.title,
      slug:           parsed.data.slug ?? null,
      bodyText:       parsed.data.bodyText,
    });
    return NextResponse.json({ template });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (/duplicate|unique/i.test(msg)) {
      return NextResponse.json({ error: "A template with this slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
