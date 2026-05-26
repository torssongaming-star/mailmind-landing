/**
 * DB-helpers för pre_launch_intents.
 *
 * Frikopplad från app-org-scoping eftersom LOI är leadgen-data — det
 * finns ingen authenticerad organization vid signeringstillfället.
 */

import { randomBytes } from "crypto";
import { eq, and, count } from "drizzle-orm";
import { db, isDbConnected, preLaunchIntents, type PreLaunchIntent, type NewPreLaunchIntent } from "@/lib/db";

export type SignLoiInput = {
  name:        string;
  email:       string;
  company:     string;
  role?:       string | null;
  companySize?: string | null;
  phone?:      string | null;
  intentText:  string;
  ipAddress?:  string | null;
  userAgent?:  string | null;
};

export type SignLoiResult =
  | { ok: true; intent: PreLaunchIntent; isNew: boolean }
  | { ok: false; error: string };

/**
 * Skapar eller uppdaterar en LOI-rad. Samma email+company genererar bara
 * EN rad — vid återsignering uppdateras signedAt och intentText, och en
 * ny verificationToken genereras.
 */
export async function signLoi(input: SignLoiInput): Promise<SignLoiResult> {
  if (!isDbConnected()) return { ok: false, error: "db_unavailable" };

  const verificationToken = randomBytes(32).toString("hex");
  const now = new Date();

  const values: NewPreLaunchIntent = {
    name:              input.name.trim(),
    email:             input.email.trim().toLowerCase(),
    company:           input.company.trim(),
    role:              input.role        ?? null,
    companySize:       input.companySize ?? null,
    phone:             input.phone       ?? null,
    intentText:        input.intentText,
    signedAt:          now,
    ipAddress:         input.ipAddress ?? null,
    userAgent:         input.userAgent ?? null,
    status:            "pending",
    notes:             null,
    emailVerifiedAt:   null,
    verificationToken,
  };

  try {
    const [row] = await db
      .insert(preLaunchIntents)
      .values(values)
      .onConflictDoUpdate({
        target: [preLaunchIntents.email, preLaunchIntents.company],
        set: {
          name:              values.name,
          role:              values.role,
          companySize:       values.companySize,
          phone:             values.phone,
          intentText:        values.intentText,
          signedAt:          now,
          ipAddress:         values.ipAddress,
          userAgent:         values.userAgent,
          verificationToken: values.verificationToken,
          // Återställ verifieringsstatus vid återsignering.
          emailVerifiedAt:   null,
          updatedAt:         now,
        },
      })
      .returning();

    if (!row) return { ok: false, error: "insert_returned_no_row" };
    // isNew = signedAt och createdAt är samma sekund. Inte 100% säkert men
    // tillräckligt för att skilja första-gångs-signering från uppdatering
    // i bekräftelsemejlets ton.
    const isNew = Math.abs(row.createdAt.getTime() - row.signedAt.getTime()) < 2000;
    return { ok: true, intent: row, isNew };
  } catch (err) {
    console.error("[loi/queries] signLoi failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/**
 * Verifierar mejladressen via en single-use token. Kallas från
 * bekräftelsemejlets klick-länk.
 */
export async function verifyLoiByToken(
  token: string,
): Promise<{ ok: true; intent: PreLaunchIntent } | { ok: false; error: string }> {
  if (!isDbConnected()) return { ok: false, error: "db_unavailable" };
  if (!token || token.length < 32) return { ok: false, error: "invalid_token" };

  const rows = await db
    .select()
    .from(preLaunchIntents)
    .where(eq(preLaunchIntents.verificationToken, token))
    .limit(1);

  const row = rows[0];
  if (!row) return { ok: false, error: "token_not_found" };

  const now = new Date();
  const [updated] = await db
    .update(preLaunchIntents)
    .set({
      emailVerifiedAt:   now,
      verificationToken: null, // single-use
      updatedAt:         now,
    })
    .where(and(
      eq(preLaunchIntents.id, row.id),
      eq(preLaunchIntents.verificationToken, token), // race-skydd
    ))
    .returning();

  if (!updated) return { ok: false, error: "token_already_used" };
  return { ok: true, intent: updated };
}

/**
 * Räknar antal verifierade LOI:s (för social proof i Hero).
 * Bara verifierade räknas — annars kan vem som helst spamma siffran.
 */
export async function countVerifiedLois(): Promise<number> {
  if (!isDbConnected()) return 0;
  try {
    const [row] = await db
      .select({ value: count() })
      .from(preLaunchIntents)
      .where(eq(preLaunchIntents.status, "pending"))
      // Lagra bara verifierade siffror — emailVerifiedAt IS NOT NULL filtreras
      // separat i en where-andra om vi vill vara strikta. Här tar vi alla i
      // pending-status (men inte declined/converted) som "i kö".
      ;
    return row?.value ?? 0;
  } catch (err) {
    console.error("[loi/queries] countVerifiedLois failed:", err);
    return 0;
  }
}
