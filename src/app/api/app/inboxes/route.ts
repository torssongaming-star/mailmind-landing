/**
 * /api/app/inboxes
 *
 * GET  — list connected inboxes for the user's org
 * POST — create a new inbox. Currently only the "mailmind" provider is
 *        supported (hosted forwarder); IMAP/Gmail/Outlook coming later.
 *
 * Mailmind inbox creation:
 *   - User picks a slug (e.g. "support") → we generate a unique slug if
 *     theirs is taken (suffix with random 4 chars)
 *   - We return the address `<slug>@mail.mailmind.se` they should forward to
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listInboxes, getInboxByEmail, createMailmindInbox } from "@/lib/app/threads";
import { writeAuditLog } from "@/lib/app/audit";

export const runtime = "nodejs";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$/;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }

  const list = await listInboxes(account.organization.id);
  return NextResponse.json({ inboxes: list });
}

const PostBody = z.object({
  /** Customer-chosen prefix; we'll suffix if taken */
  slug:           z.string().regex(SLUG_PATTERN, "lowercase letters, digits, hyphens; 3-42 chars"),
  displayName:    z.string().trim().min(1).max(255),
  /** Optional: the customer's actual inbox address that forwards here (display only) */
  forwardedFrom:  z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return NextResponse.json({ error: "Account not provisioned" }, { status: 400 });
  }
  if (!account.access.canUseApp) {
    return NextResponse.json({ error: "App access blocked", reason: account.access.reason }, { status: 403 });
  }

  // Inbox count vs entitlement
  const existing = await listInboxes(account.organization.id);
  const limit = account.entitlements?.maxInboxes ?? 0;
  if (existing.length >= limit) {
    return NextResponse.json(
      { error: `Inbox limit reached (${existing.length}/${limit}). Upgrade to add more.` },
      { status: 403 }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  // Resolve a unique slug — try the requested one, then suffix with random hex
  let slug = parsed.data.slug.toLowerCase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? slug : `${slug}-${randomBytes(2).toString("hex")}`;
    const candidateEmail = `${candidate}@mail.mailmind.se`;
    const taken = await getInboxByEmail(candidateEmail);
    if (!taken) {
      slug = candidate;
      break;
    }
    if (attempt === 4) {
      return NextResponse.json({ error: "Could not allocate a unique slug, try a different one" }, { status: 409 });
    }
  }

  let inbox;
  try {
    inbox = await createMailmindInbox({
      organizationId: account.organization.id,
      slug,
      displayName:    parsed.data.displayName,
      forwardedFrom:  parsed.data.forwardedFrom,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown DB error";
    console.error("[inboxes] create failed:", msg);
    // Common case: invalid input value for enum — happens if `mailmind` enum
    // value wasn't added to inbox_provider type. Run `ALTER TYPE inbox_provider
    // ADD VALUE 'mailmind';` directly in Neon if drizzle-kit push skipped it.
    if (/invalid input value for enum/i.test(msg)) {
      return NextResponse.json({
        error: "Database enum is missing the 'mailmind' value. Run: ALTER TYPE inbox_provider ADD VALUE 'mailmind'; in Neon SQL editor.",
      }, { status: 500 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (!inbox) {
    return NextResponse.json({ error: "DB unavailable (DATABASE_URL not set)" }, { status: 503 });
  }

  await writeAuditLog({
    organizationId: account.organization.id,
    userId:         account.user.id,
    action:         "inbox_connected",
    metadata:       { inboxId: inbox.id, email: inbox.email, provider: "mailmind" },
  });

  return NextResponse.json({ inbox });
}
