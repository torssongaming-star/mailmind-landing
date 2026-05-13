/**
 * GET /api/app/webhooks/[id]/deliveries
 *
 * Returns the most recent delivery attempts for one webhook endpoint.
 * Scoped to the caller's org — cross-org access is impossible because the
 * underlying query joins on both endpointId AND organizationId.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listRecentDeliveries } from "@/lib/app/webhooks";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const { id } = await params;
  const deliveries = await listRecentDeliveries(account.organization.id, id, 20);
  return NextResponse.json({ deliveries });
}
