import { NextRequest, NextResponse } from "next/server";
import { db, isDbConnected, signatureAssets } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * GET /api/public/signature-assets/[id]
 *
 * Public endpoint to fetch and serve hosted signature images.
 * Serves them as raw binary data with strong caching headers.
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

    let mimeType = asset.mimeType;
    let base64Data = asset.data;

    // Check if the data is a data URL (e.g. data:image/png;base64,iVBORw0KGg...)
    const dataUrlMatch = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      base64Data = dataUrlMatch[2];
    }

    // Convert Base64 payload back to binary buffer
    const buffer = Buffer.from(base64Data, "base64");

    // Return raw binary content with strong CDN caching headers
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Public signature delivery route error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
