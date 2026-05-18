"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updatePersonalSignature(signature: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Validate string length (max 2000 chars should be plenty for a signature)
  if (signature.length > 500000) {
    throw new Error("Signaturen är för lång (max 500 000 tecken, försök minska storleken på inbäddade bilder)");
  }

  await db
    .update(users)
    .set({ signature: signature.trim() || null })
    .where(eq(users.clerkUserId, userId));

  revalidatePath("/app/settings/account");
  return { ok: true };
}
