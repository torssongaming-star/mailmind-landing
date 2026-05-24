import { NextRequest, NextResponse } from "next/server";
import { db, isDbConnected, signatureAssets } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * GET /api/public/signature-assets/[id]
 *
 * Public endpoint to fetch and serve hosted signature images.
 *
 * Dual-path:
 *   - New rows (blob_url is set): 302 redirect to Vercel Blob CDN.
 *   - Legacy rows (data column populated, blob_url null): decode the base64
 *     payload and return the raw bytes directly. Migrating these into Blob is
 *     handled by `src/scripts/migrate-signatures-to-blob.ts`.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isDbConnected()) {
      return new NextResponse("Database disconnected", { status: 503 });
    }

    const { id } = await params;
    if (!id) {
      return new NextResponse("Invalid ID", { status: 400 });
    }

    // Query signature asset by ID
    const [asset] = await db
      .select()
      .from(signatureAssets)
      .where(eq(signatureAssets.id, id))
      .limit(1);

    if (!asset) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Fast path — bytes live in Vercel Blob. Let the CDN serve them.
    if (asset.blobUrl) {
      return NextResponse.redirect(asset.blobUrl, 302);
    }

    // Legacy path — bytes are base64 in the DB row.
    if (!asset.data) {
      // No blob, no data — row is corrupt or mid-migration. Treat as missing.
      return new NextResponse("Not Found", { status: 404 });
    }

    let mimeType = asset.mimeType;
    let base64Data = asset.data;

    // Check if the data is a data URL (e.g. data:image/png;base64,iVBORw0KGg...)
    const dataUrlMatch = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      base64Data = dataUrlMatch[2];
    }

    // Even though upload now enforces a strict raster-image allowlist, an
    // old row in the DB could still be SVG or other risky type. Belt and
    // braces: only ever serve known-safe image types from this route.
    const SAFE_DELIVERY_TYPES = new Set([
      "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
    ]);
    if (!SAFE_DELIVERY_TYPES.has(mimeType)) {
      return new NextResponse("Asset type not allowed", { status: 415 });
    }

    // Convert Base64 payload back to binary buffer
    const buffer = Buffer.from(base64Data, "base64");

    // Return raw binary content with strong CDN caching headers
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":           mimeType,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'",
        "Cache-Control":          "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Public signature delivery route error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
