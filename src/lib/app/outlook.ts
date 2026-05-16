/**
 * Microsoft 365 / Outlook OAuth + Graph API helpers.
 *
 * Tokens are encrypted with AES-256-GCM before being stored in inboxes.config,
 * identical to the Gmail token encryption pattern.
 *
 * Required env vars:
 *   OUTLOOK_CLIENT_ID      — Azure AD application (client) ID
 *   OUTLOOK_CLIENT_SECRET  — Azure AD client secret value
 *   OUTLOOK_ENCRYPT_KEY    — 64 hex chars (32 bytes), generate with:
 *                            node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Optional:
 *   NEXT_PUBLIC_APP_URL    — defaults to https://mailmind.se
 *
 * Azure AD app setup:
 *   1. Register app at https://portal.azure.com → Azure AD → App registrations
 *   2. Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
 *   3. Add redirect URI (Web): https://mailmind.se/api/app/inboxes/outlook/callback
 *   4. API permissions: Mail.Read, Mail.Send, User.Read (all Delegated)
 *   5. Create a client secret and copy the value as OUTLOOK_CLIENT_SECRET
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT          = "common"; // allows personal + org Microsoft accounts
const AUTH_URL        = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`;
const TOKEN_URL       = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
const GRAPH_BASE      = "https://graph.microsoft.com/v1.0";

const SCOPES = [
  "https://graph.microsoft.com/Mail.Read",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/User.Read",
  "offline_access",
].join(" ");

/**
 * The clientState Microsoft sends back on every notification — we verify
 * it on the webhook side. Prefer the dedicated MICROSOFT_CLIENT_STATE
 * (random secret), fall back to OUTLOOK_CLIENT_ID for subscriptions
 * created before the dedicated var was introduced.
 */
export function getExpectedClientState(): string {
  return (
    process.env.MICROSOFT_CLIENT_STATE ??
    process.env.OUTLOOK_CLIENT_ID ??
    "mailmind"
  );
}

function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://mailmind.se";
  return `${base}/api/app/inboxes/outlook/callback`;
}

// ---------------------------------------------------------------------------
// Token encryption / decryption (AES-256-GCM, same scheme as gmail.ts)
// ---------------------------------------------------------------------------

function encryptKey(): Buffer {
  const hex = process.env.OUTLOOK_ENCRYPT_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("OUTLOOK_ENCRYPT_KEY must be 64 hex chars (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export type OutlookTokens = {
  accessToken:  string;
  refreshToken: string;
  expiresAt:    number; // unix ms
  email:        string; // the Outlook/M365 address
};

/** Encrypt tokens → opaque string stored in inboxes.config.encryptedTokens */
export function encryptTokens(tokens: OutlookTokens): string {
  const iv        = randomBytes(12);
  const cipher    = createCipheriv("aes-256-gcm", encryptKey(), iv);
  const plain     = Buffer.from(JSON.stringify(tokens), "utf8");
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const authTag   = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/** Decrypt the string from inboxes.config.encryptedTokens */
export function decryptTokens(raw: string): OutlookTokens {
  const buf      = Buffer.from(raw, "base64");
  const iv       = buf.subarray(0, 12);
  const authTag  = buf.subarray(12, 28);
  const payload  = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptKey(), iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(payload), decipher.final()]);
  return JSON.parse(plain.toString("utf8")) as OutlookTokens;
}

// ---------------------------------------------------------------------------
// OAuth URL
// ---------------------------------------------------------------------------

export function buildOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.OUTLOOK_CLIENT_ID ?? "",
    redirect_uri:  redirectUri(),
    response_type: "code",
    scope:         SCOPES,
    response_mode: "query",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

// ---------------------------------------------------------------------------
// Code → tokens
// ---------------------------------------------------------------------------

type RawTokenResponse = {
  access_token:  string;
  refresh_token: string;
  expires_in:    number;
  token_type:    string;
};

export async function exchangeCode(code: string): Promise<Omit<OutlookTokens, "email">> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.OUTLOOK_CLIENT_ID     ?? "",
      client_secret: process.env.OUTLOOK_CLIENT_SECRET ?? "",
      redirect_uri:  redirectUri(),
      grant_type:    "authorization_code",
      scope:         SCOPES,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Microsoft token exchange failed (${res.status}): ${body}`);
  }

  const data = await res.json() as RawTokenResponse;
  if (!data.refresh_token) {
    throw new Error("Microsoft did not return a refresh_token. Ensure offline_access scope is requested.");
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

export async function refreshAccessToken(tokens: OutlookTokens): Promise<OutlookTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.OUTLOOK_CLIENT_ID     ?? "",
      client_secret: process.env.OUTLOOK_CLIENT_SECRET ?? "",
      refresh_token: tokens.refreshToken,
      grant_type:    "refresh_token",
      scope:         SCOPES,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Microsoft token refresh failed (${res.status}): ${body}`);
  }

  const data = await res.json() as RawTokenResponse;
  return {
    ...tokens,
    accessToken: data.access_token,
    ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
    expiresAt:   Date.now() + data.expires_in * 1000,
  };
}

export async function getValidAccessToken(
  tokens: OutlookTokens,
): Promise<{ token: string; updated: OutlookTokens | null }> {
  if (Date.now() < tokens.expiresAt - 60_000) {
    return { token: tokens.accessToken, updated: null };
  }
  const updated = await refreshAccessToken(tokens);
  return { token: updated.accessToken, updated };
}

// ---------------------------------------------------------------------------
// Graph API — user profile
// ---------------------------------------------------------------------------

export async function getOutlookAddress(accessToken: string): Promise<string> {
  const res = await fetch(`${GRAPH_BASE}/me?$select=mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Graph profile fetch failed (${res.status})`);
  const data = await res.json() as { mail?: string; userPrincipalName?: string };
  const email = data.mail ?? data.userPrincipalName;
  if (!email) throw new Error("Could not determine email address from Microsoft profile");
  return email.toLowerCase();
}

// ---------------------------------------------------------------------------
// Graph API — push notification subscription
// ---------------------------------------------------------------------------

type GraphSubscriptionResponse = {
  id:                       string;
  expirationDateTime:       string;
  notificationUrl:          string;
  changeType:               string;
};

/**
 * Register a Graph API change-notification subscription for the user's Inbox.
 * Microsoft allows max 4320 minutes (3 days) for mail subscriptions.
 * Returns the subscription ID and expiry to store in inbox.config.
 */
export async function createMailSubscription(
  accessToken: string,
  notificationUrl: string,
): Promise<{ subscriptionId: string; expirationDateTime: string }> {
  // 3 days from now (max allowed for mail)
  const expiry = new Date(Date.now() + 4320 * 60 * 1000).toISOString();

  const res = await fetch(`${GRAPH_BASE}/subscriptions`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      changeType:              "created",
      notificationUrl,
      resource:                "me/mailFolders('Inbox')/messages",
      expirationDateTime:      expiry,
      clientState:             getExpectedClientState(),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph subscription creation failed (${res.status}): ${body}`);
  }

  const data = await res.json() as GraphSubscriptionResponse;
  return { subscriptionId: data.id, expirationDateTime: data.expirationDateTime };
}

/**
 * Renew an existing subscription (extend expiry by another 3 days).
 * Called by the daily cron tick for subscriptions expiring within 24h.
 */
export async function renewMailSubscription(
  accessToken: string,
  subscriptionId: string,
): Promise<string> {
  const expiry = new Date(Date.now() + 4320 * 60 * 1000).toISOString();
  const res = await fetch(`${GRAPH_BASE}/subscriptions/${subscriptionId}`, {
    method: "PATCH",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expirationDateTime: expiry }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph subscription renewal failed (${res.status}): ${body}`);
  }
  const data = await res.json() as GraphSubscriptionResponse;
  return data.expirationDateTime;
}

// ---------------------------------------------------------------------------
// Graph API — fetch and parse a single message
// ---------------------------------------------------------------------------

type GraphMessage = {
  id:               string;
  conversationId:   string;
  subject:          string;
  internetMessageId: string;
  from:             { emailAddress: { name: string; address: string } };
  body:             { content: string; contentType: "text" | "html" };
  toRecipients:     { emailAddress: { name: string; address: string } }[];
};

export type ParsedOutlookMessage = {
  graphMessageId:  string;
  conversationId:  string;
  fromEmail:       string;
  fromName:        string | null;
  toEmail:         string;
  subject:         string;
  bodyText:        string;
  internetMessageId: string | null;
};

function htmlToText(html: string): string {
  // Strip HTML tags — simple but sufficient for plain-text AI triage
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function getAndParseMessage(
  accessToken: string,
  messageId: string,
): Promise<ParsedOutlookMessage | null> {
  const select = [
    "id", "conversationId", "subject", "internetMessageId",
    "from", "toRecipients", "body",
  ].join(",");

  const res = await fetch(
    `${GRAPH_BASE}/me/messages/${messageId}?$select=${select}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return null;

  const msg = await res.json() as GraphMessage;
  const bodyText = msg.body.contentType === "html"
    ? htmlToText(msg.body.content)
    : msg.body.content.trim();

  return {
    graphMessageId:    msg.id,
    conversationId:    msg.conversationId,
    fromEmail:         msg.from.emailAddress.address.toLowerCase(),
    fromName:          msg.from.emailAddress.name || null,
    toEmail:           msg.toRecipients[0]?.emailAddress.address.toLowerCase() ?? "",
    subject:           msg.subject ?? "(no subject)",
    bodyText,
    internetMessageId: msg.internetMessageId ?? null,
  };
}

// ---------------------------------------------------------------------------
// Graph API — send email
// ---------------------------------------------------------------------------

export type OutlookSendParams = {
  from:       string;
  to:         string;
  subject:    string;
  text:       string;
  inReplyTo?: string | null;
  references?: string | null;
};

export type OutlookSendResult =
  | { ok: true;  messageId: string }
  | { ok: false; error: string };

/**
 * Send an email via Microsoft Graph API using the authenticated user's mailbox.
 * Graph does not return a message ID on successful sendMail — we use
 * the internet message-id pattern instead; null is fine for threading.
 */
export async function sendViaOutlook(
  accessToken: string,
  params: OutlookSendParams,
): Promise<OutlookSendResult> {
  const { from, to, subject, text, inReplyTo, references } = params;

  const internetMessageHeaders: { name: string; value: string }[] = [];
  if (inReplyTo)  internetMessageHeaders.push({ name: "In-Reply-To", value: inReplyTo });
  if (references) internetMessageHeaders.push({ name: "References",  value: references });

  const body: Record<string, unknown> = {
    message: {
      subject,
      from:         { emailAddress: { address: from } },
      toRecipients: [{ emailAddress: { address: to } }],
      body:         { contentType: "Text", content: text },
      ...(internetMessageHeaders.length > 0 ? { internetMessageHeaders } : {}),
    },
    saveToSentItems: true,
  };

  const res = await fetch(`${GRAPH_BASE}/me/sendMail`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // Graph sendMail returns 202 Accepted with no body on success
  if (res.status !== 202 && !res.ok) {
    const err = await res.text();
    return { ok: false, error: `Graph sendMail failed (${res.status}): ${err}` };
  }

  // No message ID available from sendMail — caller uses conversationId for threading
  return { ok: true, messageId: `sent-${Date.now()}` };
}

// ---------------------------------------------------------------------------
// Types stored in inboxes.config for outlook provider
// ---------------------------------------------------------------------------

export type OutlookInboxConfig = {
  encryptedTokens:      string;   // output of encryptTokens()
  subscriptionId?:      string;   // Graph subscription ID for push notifications
  subscriptionExpiry?:  string;   // ISO datetime — must be renewed before this
};
