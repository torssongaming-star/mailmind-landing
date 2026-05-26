/**
 * GET /api/loi/verify?token=<...>
 *
 * Klick-länk från bekräftelsemejlet. Verifierar mejladressen genom att
 * matcha en single-use token, sätter emailVerifiedAt och raderar token.
 *
 * Redirectar alltid till /loi-sidan med en query-parameter:
 *   ?verified=1            → success ("Tack, mejladressen är bekräftad")
 *   ?verified=expired      → token finns inte / är redan använd
 *   ?verified=error        → DB-fel
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyLoiByToken } from "@/lib/loi/queries";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const base  = new URL("/loi", req.nextUrl.origin);

  if (!token) {
    base.searchParams.set("verified", "expired");
    return NextResponse.redirect(base);
  }

  const result = await verifyLoiByToken(token);
  if (!result.ok) {
    base.searchParams.set(
      "verified",
      result.error === "token_not_found" || result.error === "token_already_used"
        ? "expired"
        : "error",
    );
    return NextResponse.redirect(base);
  }

  base.searchParams.set("verified", "1");
  return NextResponse.redirect(base);
}
