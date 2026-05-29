/**
 * GET /api/loi/verify?token=<...>
 *
 * Klick-länk från bekräftelsemejlet. Verifierar mejladressen genom att
 * matcha en single-use token, sätter emailVerifiedAt och raderar token.
 *
 * Redirectar:
 *   /loi/verified          → success (dedikerad välkomstsida)
 *   /loi?verified=expired  → token finns inte / är redan använd
 *   /loi?verified=error    → DB-fel
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyLoiByToken } from "@/lib/loi/queries";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token    = req.nextUrl.searchParams.get("token") ?? "";
  const loiBase  = new URL("/loi", req.nextUrl.origin);

  if (!token) {
    loiBase.searchParams.set("verified", "expired");
    return NextResponse.redirect(loiBase);
  }

  const result = await verifyLoiByToken(token);
  if (!result.ok) {
    loiBase.searchParams.set(
      "verified",
      result.error === "token_not_found" || result.error === "token_already_used"
        ? "expired"
        : "error",
    );
    return NextResponse.redirect(loiBase);
  }

  // Success — show the dedicated welcome page instead of the form page.
  return NextResponse.redirect(new URL("/loi/verified", req.nextUrl.origin));
}
