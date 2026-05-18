"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updatePersonalSignature(signature: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Validate string length (max 2000 chars should be plenty for a signature)
  if (signature.length > 2000) {
    throw new Error("Signature is too long");
  }

  await db
    .update(users)
    .set({ signature: signature.trim() || null })
    .where(eq(users.clerkUserId, userId));

  revalidatePath("/app/settings/account");
  return { ok: true };
}
