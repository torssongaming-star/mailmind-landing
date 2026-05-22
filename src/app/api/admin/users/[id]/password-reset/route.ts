import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, getAdminIdentity } from "@/lib/admin/auth";
import { createClerkClient } from "@clerk/nextjs/server";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { adminAuditLogs } from "@/lib/db/schema";

/**
 * POST /api/admin/users/[id]/password-reset
 *
 * Generates a 15-minute Clerk sign-in token, emails it to the user via
 * Resend, and audits the action. From there the user can sign in and
 * reset their password from account settings.
 *
 * Previous behaviour: returned success but only wrote an audit row —
 * no email was sent, admin was misled into thinking the user had been
 * notified. Now the route either truly delivers the email or fails loud.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAdminApi();
    const admin = await getAdminIdentity();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const user = await clerk.users.getUser(id);
    const targetEmail = user.emailAddresses[0]?.emailAddress;
    if (!targetEmail) {
      return NextResponse.json({ error: "User has no email address on file" }, { status: 400 });
    }

    // Clerk one-time sign-in token, valid 15 min.
    const token = await clerk.signInTokens.createSignInToken({
      userId:           id,
      expiresInSeconds: 60 * 15,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://mailmind.se";
    const signInUrl = `${appUrl}/login?__clerk_ticket=${encodeURIComponent(token.token)}`;

    // Deliver via Resend. If this fails we DON'T claim success — the admin
    // must know the user wasn't actually notified.
    const apiKey   = process.env.RESEND_API_KEY;
    const fromAddr = process.env.DEMO_REQUEST_FROM ?? "Mailmind <noreply@mailmind.se>";
    if (!apiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY missing — cannot send email" }, { status: 500 });
    }
    const resend = new Resend(apiKey);
    const { error: sendErr } = await resend.emails.send({
      from:    fromAddr,
      to:      targetEmail,
      replyTo: process.env.SUPPORT_EMAIL_TO ?? "support@mailmind.se",
      subject: "Återställ ditt Mailmind-lösenord",
      text:
        `Hej!\n\n` +
        `En administratör har begärt en lösenordsåterställning för ditt Mailmind-konto.\n` +
        `Klicka på länken nedan för att logga in (giltig i 15 minuter). När du är inloggad ` +
        `kan du sätta ett nytt lösenord under Kontoinställningar.\n\n` +
        `${signInUrl}\n\n` +
        `Om du inte begärde detta kan du ignorera mejlet.`,
    });

    if (sendErr) {
      console.error("[admin/password-reset] Resend failed:", sendErr);
      return NextResponse.json(
        { error: "Email delivery failed", detail: String(sendErr.message ?? sendErr) },
        { status: 502 },
      );
    }

    await db.insert(adminAuditLogs).values({
      actorClerkUserId:  admin.clerkUserId,
      actorEmail:        admin.email || "unknown",
      action:            "password_reset_sent",
      targetClerkUserId: id,
      metadata: {
        target_email:        targetEmail,
        token_expires_in_s:  900,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Återställnings-mejl skickat. Länken är giltig i 15 minuter.",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json({ error: "Failed to trigger reset" }, { status: 500 });
  }
}
