/**
 * /api/app/ai-settings
 *
 * GET — current org's AI behaviour settings (or sane defaults if not yet customised)
 * PUT — upsert the org's settings
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, isDbConnected, aiSettings } from "@/lib/db";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { getAiSettings, defaultAiSettings } from "@/lib/app/threads";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const orgId = account.organization.id;
  const settings = (await getAiSettings(orgId)) ?? defaultAiSettings(orgId);
  return NextResponse.json({ settings });
}

const Body = z.object({
  tone:            z.enum(["formal", "friendly", "neutral"]),
  language:        z.string().min(2).max(10),
  maxInteractions: z.number().int().min(1).max(5),
  signature:       z.string().max(2000).nullable().optional(),
});

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const orgId = account.organization.id;

  if (!isDbConnected()) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }

  await db
    .insert(aiSettings)
    .values({
      organizationId:   orgId,
      tone:             parsed.data.tone,
      language:         parsed.data.language,
      maxInteractions:  parsed.data.maxInteractions,
      signature:        parsed.data.signature ?? null,
    })
    .onConflictDoUpdate({
      target: aiSettings.organizationId,
      set: {
        tone:             parsed.data.tone,
        language:         parsed.data.language,
        maxInteractions:  parsed.data.maxInteractions,
        signature:        parsed.data.signature ?? null,
        updatedAt:        new Date(),
      },
    });

  const updated = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.organizationId, orgId))
    .limit(1);

  return NextResponse.json({ settings: updated[0] });
}
