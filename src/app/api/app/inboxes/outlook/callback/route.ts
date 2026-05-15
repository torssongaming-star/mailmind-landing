/**
 * GET /api/app/inboxes/outlook/callback
 *
 * Microsoft redirects here after the user grants consent.
 * 1. Validates CSRF state cookie
 * 2. Exchanges auth code for access + refresh tokens
 * 3. Fetches the user's email address via Graph API
 * 4. Encrypts tokens and stores them in a new inbox row
 * 5. Registers a Graph change-notification subscription (push)
 * 6. Redirects to /app/inboxes
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  exchangeCode,
  getOutlookAddress,
  encryptTokens,
  createMailSubscription,
  type OutlookInboxConfig,
} from "@/lib/app/outlook";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listInboxes, getInboxByEmail, createOutlookInbox, updateInboxConfig } from "@/lib/app/threads";
import { writeAuditLog } from "@/lib/app/audit";

export const runtime = "nodejs";

const APP_INBOXES = "/app/inboxes";

function errorRedirect(msg: string) {
  const url = new URL(APP_INBOXES, process.env.NEXT_PUBLIC_APP_URL ?? "https://mailmind.se");
  url.searchParams.set("error", msg);
  return NextResponse.redirect(url.toString());
}

export async function GET(req: NextRequest) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) return errorRedirect("Not signed in");

  const account = await getCurrentAccount(userId);
  if (!account.user || !account.organization) {
    return errorRedirect("Account not provisioned");
  }
  if (!account.access.canUseApp) {
    return errorRedirect("App access blocked");
  }

  // ── 2. CSRF check ──────────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const returnedState = searchParams.get("state") ?? "";
  const cookieState   = req.cookies.get("outlook_oauth_state")?.value ?? "";

  if (!cookieState || returnedState !== cookieState) {
    return errorRedirect("Invalid OAuth state. Please try again.");
  }

  const code = searchParams.get("code");
  if (!code) {
    const msError = searchParams.get("error_description") ?? searchParams.get("error") ?? "No code returned";
    return errorRedirect(`Microsoft OAuth error: ${msError}`);
  }

  // ── 3. Inbox limit check ───────────────────────────────────────────────────
  const existing = await listInboxes(account.organization.id);
  const limit    = account.entitlements?.maxInboxes ?? 0;
  if (existing.length >= limit) {
    return errorRedirect(`Inbox limit reached (${existing.length}/${limit}). Upgrade to add more.`);
  }

  // ── 4. Exchange code → tokens ──────────────────────────────────────────────
  let rawTokens: Awaited<ReturnType<typeof exchangeCode>>;
  try {
    rawTokens = await exchangeCode(code);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token exchange failed";
    console.error("[outlook/callback] token exchange:", msg);
    return errorRedirect(msg);
  }

  // ── 5. Fetch email address via Graph ──────────────────────────────────────
  let outlookEmail: string;
  try {
    outlookEmail = await getOutlookAddress(rawTokens.accessToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not fetch Outlook address";
    console.error("[outlook/callback] profile fetch:", msg);
    return errorRedirect(msg);
  }

  // ── 6. Duplicate check ────────────────────────────────────────────────────
  const duplicate = await getInboxByEmail(outlookEmail);
  if (duplicate) {
    return errorRedirect(`${outlookEmail} is already connected as an inbox.`);
  }

  // ── 7. Encrypt tokens + persist inbox ─────────────────────────────────────
  const tokens = { ...rawTokens, email: outlookEmail };
  const config: OutlookInboxConfig = { encryptedTokens: encryptTokens(tokens) };

  let inbox;
  try {
    inbox = await createOutlookInbox({
      organizationId: account.organization.id,
      email:          outlookEmail,
      displayName:    outlookEmail,
      config:         config as Record<string, unknown>,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DB error";
    console.error("[outlook/callback] createOutlookInbox:", msg);
    return errorRedirect("Could not save inbox. Please try again.");
  }

  if (!inbox) return errorRedirect("Database unavailable");

  // ── 8. Register Graph push notifications ─────────────────────────────────
  const notificationUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://mailmind.se"}/api/webhooks/microsoft/notifications`;
  try {
    const { subscriptionId, expirationDateTime } = await createMailSubscription(
      tokens.accessToken,
      notificationUrl,
    );
    const updatedConfig: OutlookInboxConfig = {
      ...config,
      subscriptionId,
      subscriptionExpiry: expirationDateTime,
    };
    await updateInboxConfig(inbox.id, updatedConfig as Record<string, unknown>);
  } catch (err) {
    // Non-fatal — inbox is still connected, push just won't work until manually re-registered
    console.error("[outlook/callback] subscription creation failed:", err instanceof Error ? err.message : err);
  }

  await writeAuditLog({
    organizationId: account.organization.id,
    userId:         account.user.id,
    action:         "inbox_connected",
    metadata:       { inboxId: inbox.id, email: outlookEmail, provider: "outlook" },
  });

  // ── 9. Clear state cookie + redirect ──────────────────────────────────────
  const successUrl = new URL(APP_INBOXES, process.env.NEXT_PUBLIC_APP_URL ?? "https://mailmind.se");
  successUrl.searchParams.set("connected", outlookEmail);
  const response = NextResponse.redirect(successUrl.toString());
  response.cookies.delete("outlook_oauth_state");
  return response;
}
