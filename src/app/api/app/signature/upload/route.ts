import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import * as Sentry from "@sentry/nextjs";
import { db, isDbConnected, signatureAssets } from "@/lib/db";
import { getCurrentAccount } from "@/lib/app/entitlements";

export const runtime = "nodejs";

/**
 * POST /api/app/signature/upload
 *
 * Secure, Clerk-authenticated endpoint to receive signature image uploads.
 * Restricts access to authenticated users with provisioned organizations.
 *
 * Image bytes go to Vercel Blob; the DB row only stores metadata + the blob
 * URL. Legacy rows still using the base64 `data` column are read transparently
 * by the public serve route.
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

    // Raster formats only — SVG is excluded because it can carry <script>
    // and embedded JS that fires when the asset is served via our public
    // delivery route. PDFs/HTML obviously not images either.
    const ALLOWED_MIME = new Set([
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
    ]);
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: "Endast PNG, JPEG, WebP eller GIF tillåts." },
        { status: 400 },
      );
    }

    // Hard size cap — signature images shouldn't be heavy. Without this a
    // client could upload a 50 MB file and bloat the DB row.
    const MAX_BYTES = 1_500_000; // 1.5 MB
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Bilden är för stor (max 1.5 MB efter komprimering)." },
        { status: 413 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Magic-byte check — file.type is user-controlled (browser-supplied),
    // so cross-check the first bytes match an image header. Stops the
    // "rename evil.svg to evil.png" attack.
    if (!isRecognisedImageHeader(buffer)) {
      return NextResponse.json(
        { error: "Filen ser inte ut att vara en giltig bild." },
        { status: 400 },
      );
    }

    // Sanitize the filename for the blob path: only allow alphanumeric, dot,
    // hyphen. Anything else (spaces, unicode, slashes) becomes `_`. Cap at
    // 100 chars so we never produce an absurdly long blob key.
    const safeFileName = (file.name || "signature_image")
      .replace(/[^a-zA-Z0-9.\-]/g, "_")
      .slice(0, 100);

    // Upload to Vercel Blob. We include a UUID in the path so we own
    // collision avoidance and don't need Blob's addRandomSuffix.
    let blobUrl: string;
    try {
      const blob = await put(
        `signatures/${account.organization.id}/${randomUUID()}-${safeFileName}`,
        buffer,
        {
          access: "public",
          contentType: file.type,
          addRandomSuffix: false, // we already include a uuid
        },
      );
      blobUrl = blob.url;
    } catch (blobError) {
      Sentry.captureException(blobError, {
        tags: { component: "signature-upload", step: "blob-put" },
      });
      console.error("Signature image blob upload error:", blobError);
      return NextResponse.json(
        {
          error:
            "Signature storage unavailable. Set BLOB_READ_WRITE_TOKEN in your Vercel project (Storage → Create Blob → Copy token).",
        },
        { status: 500 },
      );
    }

    // Insert signature asset metadata into the database. `data` stays NULL
    // for new rows — the bytes live in Blob.
    const [inserted] = await db
      .insert(signatureAssets)
      .values({
        organizationId: account.organization.id,
        fileName: file.name || "signature_image",
        mimeType: file.type,
        blobUrl,
      })
      .returning();

    if (!inserted) {
      return NextResponse.json({ error: "Failed to store image metadata in database" }, { status: 500 });
    }

    // Return the public deliverable URL. Same internal route as before so
    // existing email templates referencing /api/public/signature-assets/{id}
    // keep working — the route now 302s to the blob CDN under the hood.
    return NextResponse.json({
      url: `/api/public/signature-assets/${inserted.id}`,
    });
  } catch (error) {
    Sentry.captureException(error, { tags: { component: "signature-upload" } });
    console.error("Signature image upload API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Sniff the first few bytes to confirm the file is actually one of our
 * allowed raster image formats. Defeats the rename-to-bypass-mime attack.
 */
function isRecognisedImageHeader(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // GIF: 47 49 46 38 ("GIF8")
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // WebP: RIFF????WEBP — bytes 0-3 RIFF, 8-11 WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return true;
  return false;
}
