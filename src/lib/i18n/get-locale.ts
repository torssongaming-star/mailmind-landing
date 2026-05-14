import { auth } from "@clerk/nextjs/server";
import { db, isDbConnected } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Locale } from "./types";
import { cookies } from "next/headers";

export async function getUserLocale(): Promise<Locale> {
  try {
    // 1. Try to get from cookie first (fastest, for non-logged in or just switched)
    const cookieStore = await cookies();
    const localeCookie = cookieStore.get("NEXT_LOCALE")?.value as Locale;
    if (localeCookie === "sv" || localeCookie === "en") {
      return localeCookie;
    }

    // 2. Try to get from DB if logged in
    const { userId } = await auth();
    if (userId && isDbConnected()) {
      const user = await db.query.users.findFirst({
        where: eq(users.clerkUserId, userId),
      });
      if (user?.locale === "sv" || user?.locale === "en") {
        return user.locale as Locale;
      }
    }
  } catch (error) {
    console.error("Failed to get user locale:", error);
  }

  // 3. Fallback to default
  return "sv";
}
