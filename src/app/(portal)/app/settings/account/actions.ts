"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { sanitizeHtmlServer } from "@/lib/utils/sanitize-html-server";

export async function updatePersonalSignature(signature: string) {
  try {
    const { userId } = await auth();
    if (!userId) return { ok: false, error: "Unauthorized" };

    if (signature.length > 5000000) {
      return { ok: false, error: "Signaturen är för lång (max 5 miljoner tecken, bilden är troligtvis för högupplöst/stor)" };
    }

    // Server-side scrub before persisting — defence-in-depth so a payload
    // can never round-trip through the DB and into another user's session.
    const cleaned = sanitizeHtmlServer(signature.trim()) || null;

    await db
      .update(users)
      .set({ signature: cleaned })
      .where(eq(users.clerkUserId, userId));

    revalidatePath("/app/settings/account");
    return { ok: true };
  } catch (err) {
    console.error("Failed to update personal signature:", err);
    return { ok: false, error: "Ett oväntat fel uppstod när signaturen skulle sparas. Kanske är bilden för stor för databasen?" };
  }
}

export async function updateAppendSignature(appendSignature: boolean) {
  try {
    const { userId } = await auth();
    if (!userId) return { ok: false, error: "Unauthorized" };

    await db
      .update(users)
      .set({ appendSignature })
      .where(eq(users.clerkUserId, userId));

    revalidatePath("/app/settings/account");
    return { ok: true };
  } catch (err) {
    console.error("Failed to update appendSignature:", err);
    return { ok: false, error: "Kunde inte spara inställningen." };
  }
}
