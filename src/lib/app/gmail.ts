/**
 * Gmail OAuth helpers.
 *
 * Tokens are encrypted with AES-256-GCM before being stored in inboxes.config
 * so that a DB read alone is not enough to impersonate the user.
 *
 * Required env vars:
 *   GMAIL_CLIENT_ID
 *   GMAIL_CLIENT_SECRET
 *   GMAIL_ENCRYPT_KEY   — 64 hex chars (32 bytes), generate with:
 *                         node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Optional:
 *   NEXT_PUBLIC_APP_URL — defaults to https://mailmind.se
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

function redirectUri() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://mailmind.se";
  return `${base}/api/app/inboxes/gmail/callback`;
}

// ---------------------------------------------------------------------------
// Token encryption / decryption  (AES-256-GCM)
// ---------------------------------------------------------------------------

function encryptKey(): Buffer {
  const hex = process.env.GMAIL_ENCRYPT_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("GMAIL_ENCRYPT_KEY must be 64 hex chars (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export type GmailTokens = {
  accessToken:  string;
  refreshToken: string;
  expiresAt:    number; // unix ms
  email:        string; // the Gmail address
};

/** Encrypt tokens → opaque string stored in inboxes.config.encryptedTokens */
export function encryptTokens(tokens: GmailTokens): string {
  const iv         = randomBytes(12);
  const cipher     = createCipheriv("aes-256-gcm", encryptKey(), iv);
  const plain      = Buffer.from(JSON.stringify(tokens), "utf8");
  const encrypted  = Buffer.concat([cipher.update(plain), cipher.final()]);
  const authTag    = cipher.getAuthTag();
  // iv(12) | authTag(16) | ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/** Decrypt the string from inboxes.config.encryptedTokens */
export function decryptTokens(raw: string): GmailTokens {
  const buf      = Buffer.from(raw, "base64");
  const iv       = buf.subarray(0, 12);
  const authTag  = buf.subarray(12, 28);
  const payload  = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptKey(), iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(payload), decipher.final()]);
  return JSON.parse(plain.toString("utf8")) as GmailTokens;
}

// ---------------------------------------------------------------------------
// OAuth URL
// ---------------------------------------------------------------------------

/** Build the URL to redirect the user to for Google consent. */
export function buildOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.GMAIL_CLIENT_ID ?? "",
    redirect_uri:  redirectUri(),
    response_type: "code",
    scope:         SCOPES,
    access_type:   "offline",
    prompt:        "consent",   // force refresh_token on every auth
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

// ---------------------------------------------------------------------------
// Code → tokens
// ---------------------------------------------------------------------------

type RawTokenResponse = {
  access_token:  string;
  refresh_token?: string;
  expires_in:    number;
  token_type:    string;
};

/** Exchange an authorization code for access + refresh tokens. */
export async function exchangeCode(code: string): Promise<Omit<GmailTokens, "email">> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GMAIL_CLIENT_ID     ?? "",
      client_secret: process.env.GMAIL_CLIENT_SECRET ?? "",
      redirect_uri:  redirectUri(),
      grant_type:    "authorization_code",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${body}`);
  }

  const data = await res.json() as RawTokenResponse;
  if (!data.refresh_token) {
    throw new Error("Google did not return a refresh_token. Revoke app access in Google Account and try again.");
  }

  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    Date.now() + data.expires_in * 1000,
  };
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

/** Refresh an expired access token. Returns updated tokens. */
export async function refreshAccessToken(tokens: GmailTokens): Promise<GmailTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GMAIL_CLIENT_ID     ?? "",
      client_secret: process.env.GMAIL_CLIENT_SECRET ?? "",
      refresh_token: tokens.refreshToken,
      grant_type:    "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${body}`);
  }

  const data = await res.json() as RawTokenResponse;
  return {
    ...tokens,
    accessToken: data.access_token,
    expiresAt:   Date.now() + data.expires_in * 1000,
  };
}

/** Return a valid access token, refreshing if needed. */
export async function getValidAccessToken(tokens: GmailTokens): Promise<{ token: string; updated: GmailTokens | null }> {
  if (Date.now() < tokens.expiresAt - 60_000) {
    return { token: tokens.accessToken, updated: null };
  }
  const updated = await refreshAccessToken(tokens);
  return { token: updated.accessToken, updated };
}

// ---------------------------------------------------------------------------
// Gmail API helpers
// ---------------------------------------------------------------------------

/** Fetch the authenticated user's Gmail address. */
export async function getGmailAddress(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail profile fetch failed (${res.status})`);
  const data = await res.json() as { emailAddress: string };
  return data.emailAddress;
}

// ---------------------------------------------------------------------------
// Types stored in inboxes.config for gmail provider
// ---------------------------------------------------------------------------

export type GmailInboxConfig = {
  encryptedTokens: string;   // output of encryptTokens()
  historyId?:      string;   // latest Gmail historyId for push sync
  pubsubTopic?:    string;   // e.g. projects/mailmind/topics/gmail-push
};
