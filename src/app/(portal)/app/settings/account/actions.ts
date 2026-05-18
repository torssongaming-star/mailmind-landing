"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updatePersonalSignature(signature: string) {
  try {
    const { userId } = await auth();
    if (!userId) return { ok: false, error: "Unauthorized" };

    if (signature.length > 500000) {
      return { ok: false, error: "Signaturen är för lång (max 500 000 tecken, försök minska storleken på inbäddade bilder)" };
    }

    await db
      .update(users)
      .set({ signature: signature.trim() || null })
      .where(eq(users.clerkUserId, userId));

    revalidatePath("/app/settings/account");
    return { ok: true };
  } catch (err: any) {
    console.error("Failed to update personal signature:", err);
    return { ok: false, error: "Ett oväntat fel uppstod när signaturen skulle sparas. Kanske är bilden för stor för databasen?" };
  }
}
