/**
 * GET /api/app/inboxes/gmail/callback
 *
 * Google redirects here after the user grants consent.
 * 1. Validates CSRF state cookie
 * 2. Exchanges auth code for access + refresh tokens
 * 3. Fetches the Gmail address to use as the inbox email
 * 4. Encrypts tokens and stores them in a new inbox row
 * 5. Redirects to /app/inboxes
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  exchangeCode,
  getGmailAddress,
  encryptTokens,
  watchGmailInbox,
  type GmailInboxConfig,
} from "@/lib/app/gmail";
import { getCurrentAccount } from "@/lib/app/entitlements";
import { listInboxes, getInboxByEmail, createGmailInbox, updateInboxConfig } from "@/lib/app/threads";
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
  const cookieState   = req.cookies.get("gmail_oauth_state")?.value ?? "";

  if (!cookieState || returnedState !== cookieState) {
    return errorRedirect("Invalid OAuth state. Please try again.");
  }

  const code = searchParams.get("code");
  if (!code) {
    const googleError = searchParams.get("error") ?? "No code returned";
    return errorRedirect(`Google OAuth error: ${googleError}`);
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
    console.error("[gmail/callback] token exchange:", msg);
    return errorRedirect(msg);
  }

  // ── 5. Fetch Gmail address ─────────────────────────────────────────────────
  let gmailAddress: string;
  try {
    gmailAddress = await getGmailAddress(rawTokens.accessToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not fetch Gmail address";
    console.error("[gmail/callback] profile fetch:", msg);
    return errorRedirect(msg);
  }

  // ── 6. Duplicate check — same Gmail address already connected? ─────────────
  const duplicate = await getInboxByEmail(gmailAddress);
  if (duplicate) {
    return errorRedirect(`${gmailAddress} is already connected as an inbox.`);
  }

  // ── 7. Encrypt tokens + persist inbox ─────────────────────────────────────
  const tokens = { ...rawTokens, email: gmailAddress };
  const config: GmailInboxConfig = { encryptedTokens: encryptTokens(tokens) };

  let inbox;
  try {
    inbox = await createGmailInbox({
      organizationId: account.organization.id,
      email:          gmailAddress,
      displayName:    gmailAddress,
      config:         config as Record<string, unknown>,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DB error";
    console.error("[gmail/callback] createGmailInbox:", msg);
    return errorRedirect("Could not save inbox. Please try again.");
  }

  if (!inbox) return errorRedirect("Database unavailable");

  // ── 8. Register Gmail push notifications if Pub/Sub topic is configured ───
  const pubsubTopic = process.env.GMAIL_PUBSUB_TOPIC;
  if (pubsubTopic) {
    try {
      const { historyId } = await watchGmailInbox(tokens.accessToken, pubsubTopic);
      const updatedConfig: GmailInboxConfig = {
        ...config,
        historyId,
        pubsubTopic,
      };
      await updateInboxConfig(inbox.id, updatedConfig as Record<string, unknown>);
    } catch (err) {
      // Non-fatal — inbox is still connected, push just won't work until topic is set up
      console.error("[gmail/callback] watch registration failed:", err instanceof Error ? err.message : err);
    }
  }

  await writeAuditLog({
    organizationId: account.organization.id,
    userId:         account.user.id,
    action:         "inbox_connected",
    metadata:       { inboxId: inbox.id, email: gmailAddress, provider: "gmail" },
  });

  // ── 8. Clear state cookie + redirect ──────────────────────────────────────
  const successUrl = new URL(APP_INBOXES, process.env.NEXT_PUBLIC_APP_URL ?? "https://mailmind.se");
  successUrl.searchParams.set("connected", gmailAddress);
  const response = NextResponse.redirect(successUrl.toString());
  response.cookies.delete("gmail_oauth_state");
  return response;
}
