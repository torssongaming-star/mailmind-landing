import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, isDbConnected, signatureAssets } from "@/lib/db";
import { getCurrentAccount } from "@/lib/app/entitlements";

export const runtime = "nodejs";

/**
 * POST /api/app/signature/upload
 *
 * Secure, Clerk-authenticated endpoint to receive signature image uploads.
 * Restricts access to authenticated users with provisioned organizations.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await getCurrentAccount(userId);
    if (!account.user || !account.organization) {
      return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
    }

    if (!isDbConnected()) {
      return NextResponse.json({ error: "Database disconnected" }, { status: 503 });
    }

    // Parse multipart/form-data
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    // Verify it is an image
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Uploaded file is not an image" }, { status: 400 });
    }

    // Convert file content to Base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString("base64");

    // Insert signature asset into the database
    const [inserted] = await db
      .insert(signatureAssets)
      .values({
        organizationId: account.organization.id,
        fileName: file.name || "signature_image",
        mimeType: file.type,
        data: base64Data,
      })
      .returning();

    if (!inserted) {
      return NextResponse.json({ error: "Failed to store image in database" }, { status: 500 });
    }

    // Return the public deliverable URL
    return NextResponse.json({
      url: `/api/public/signature-assets/${inserted.id}`,
    });
  } catch (error) {
    console.error("Signature image upload API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
