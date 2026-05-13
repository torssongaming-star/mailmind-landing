/**
 * Cron: wake up snoozed threads.
 *
 * Runs every 15 minutes via Vercel Cron. Without this, threads only un-snooze
 * lazily when an org's inbox is loaded. The cron ensures snoozed threads come
 * back into view even if no agent is currently logged in.
 *
 * Protected by CRON_SECRET — Vercel sets Authorization: Bearer <secret>
 * automatically when invoking cron routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { wakeUpAllSnoozedThreads } from "@/lib/app/threads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const woken = await wakeUpAllSnoozedThreads();
  return NextResponse.json({ ok: true, woken });
}
