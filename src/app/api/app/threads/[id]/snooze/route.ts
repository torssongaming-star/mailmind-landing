/**
 * POST /api/app/threads/[id]/snooze
 *
 * Snooze or unsnooze a thread.
 *
 * Body:
 *   { until: string }  — ISO 8601 timestamp, e.g. "2025-05-09T08:00:00Z"
 *                        Pass null to unsnooze immediately.
 *
 * Response: { ok: true, snoozedUntil: string | null }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { getThread, updateThread } from "@/lib/app/threads";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 403 });

  const { id: threadId } = await params;

  // Verify thread belongs to this org
  const thread = await getThread(account.organization.id, threadId);
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { until?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { until } = body;

  // null or missing = unsnooze
  let snoozedUntil: Date | null = null;

  if (until != null) {
    const d = new Date(until);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid date — use ISO 8601" }, { status: 400 });
    }
    if (d <= new Date()) {
      return NextResponse.json({ error: "Snooze time must be in the future" }, { status: 400 });
    }
    snoozedUntil = d;
  }

  await updateThread(account.organization.id, threadId, { snoozedUntil });

  return NextResponse.json({
    ok: true,
    snoozedUntil: snoozedUntil ? snoozedUntil.toISOString() : null,
  });
}
