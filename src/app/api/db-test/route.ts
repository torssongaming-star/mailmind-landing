import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

/**
 * GET /api/db-test
 * 
 * Simple health check to verify Neon database connectivity.
 * Returns the Postgres version string from the database.
 */
export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured" },
      { status: 500 }
    );
  }

  try {
    const sql = neon(databaseUrl);
    const result = await sql`SELECT version()`;
    const version = result[0]?.version;

    return new NextResponse(version, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err) {
    console.error("[db-test] Connection failed:", err);
    return NextResponse.json(
      { error: "Database connection failed", details: String(err) },
      { status: 500 }
    );
  }
}
