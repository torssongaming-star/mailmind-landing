import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { locale } = body;

    if (locale !== "sv" && locale !== "en") {
      return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
    }

    // 1. Update DB
    await db.update(users)
      .set({ locale, updatedAt: new Date() })
      .where(eq(users.clerkUserId, userId));

    // 2. Update cookie for immediate UI response and middleware
    const cookieStore = await cookies();
    cookieStore.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update user settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
