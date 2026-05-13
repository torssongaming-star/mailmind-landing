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
// Gmail watch (Pub/Sub push notifications)
// ---------------------------------------------------------------------------

type WatchResponse = {
  historyId: string;
  expiration: string; // unix ms as string
};

/**
 * Register a Gmail mailbox for push notifications via Cloud Pub/Sub.
 * Must be called once after OAuth and renewed every ~7 days (Google max is 7d).
 * Returns the initial historyId to store in inbox.config.
 */
export async function watchGmailInbox(
  accessToken: string,
  topicName: string,
): Promise<{ historyId: string; expiration: string }> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topicName,
      labelIds: ["INBOX"],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail watch failed (${res.status}): ${body}`);
  }
  const data = await res.json() as WatchResponse;
  return { historyId: data.historyId, expiration: data.expiration };
}

// ---------------------------------------------------------------------------
// Gmail history — fetch new messages since last historyId
// ---------------------------------------------------------------------------

type HistoryMessage = { id: string; threadId: string };
type HistoryRecord  = { messagesAdded?: { message: HistoryMessage }[] };
type HistoryResponse = {
  history?:  HistoryRecord[];
  historyId: string;
};

/**
 * Fetch all message IDs added since `startHistoryId`.
 * Returns new message stubs + the latest historyId to persist.
 */
export async function listHistory(
  accessToken: string,
  startHistoryId: string,
): Promise<{ messages: HistoryMessage[]; latestHistoryId: string }> {
  const params = new URLSearchParams({
    startHistoryId,
    historyTypes: "messageAdded",
    labelId:      "INBOX",
  });
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/history?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  // 404 means the historyId is too old — caller should re-watch
  if (res.status === 404) {
    return { messages: [], latestHistoryId: startHistoryId };
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail history fetch failed (${res.status}): ${body}`);
  }

  const data    = await res.json() as HistoryResponse;
  const messages: HistoryMessage[] = [];
  for (const record of data.history ?? []) {
    for (const added of record.messagesAdded ?? []) {
      messages.push(added.message);
    }
  }
  return { messages, latestHistoryId: data.historyId };
}

// ---------------------------------------------------------------------------
// Fetch + parse a single Gmail message
// ---------------------------------------------------------------------------

type GmailMessagePart = {
  mimeType: string;
  body:     { data?: string; size: number };
  parts?:   GmailMessagePart[];
  headers?: { name: string; value: string }[];
};

type GmailMessageRaw = {
  id:        string;
  threadId:  string;
  labelIds?: string[];
  payload:   GmailMessagePart & { headers: { name: string; value: string }[] };
};

export type ParsedGmailMessage = {
  gmailMessageId: string;
  gmailThreadId:  string;
  fromEmail:      string;
  fromName:       string | null;
  subject:        string;
  bodyText:       string;
  messageId:      string | null; // RFC 2822 Message-ID header
  inReplyTo:      string | null;
  references:     string | null;
};

function decodeBase64Url(b64: string): string {
  const standard = b64.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(standard, "base64").toString("utf8");
}

function extractTextBody(part: GmailMessagePart): string {
  if (part.mimeType === "text/plain" && part.body.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.parts) {
    for (const child of part.parts) {
      const text = extractTextBody(child);
      if (text) return text;
    }
  }
  return "";
}

function getHeader(headers: { name: string; value: string }[], name: string): string | null {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
}

function parseFromHeader(from: string | null): { email: string; name: string | null } {
  if (!from) return { email: "", name: null };
  const match = from.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
  if (match) return { email: match[2].trim().toLowerCase(), name: match[1].trim() || null };
  return { email: from.trim().toLowerCase(), name: null };
}

/** Fetch a full Gmail message and parse it into a flat structure. */
export async function getAndParseMessage(
  accessToken: string,
  messageId: string,
): Promise<ParsedGmailMessage | null> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return null;

  const raw     = await res.json() as GmailMessageRaw;
  const headers = raw.payload.headers;
  const from    = parseFromHeader(getHeader(headers, "from"));

  return {
    gmailMessageId: raw.id,
    gmailThreadId:  raw.threadId,
    fromEmail:      from.email,
    fromName:       from.name,
    subject:        getHeader(headers, "subject") ?? "(no subject)",
    bodyText:       extractTextBody(raw.payload).trim(),
    messageId:      getHeader(headers, "message-id"),
    inReplyTo:      getHeader(headers, "in-reply-to"),
    references:     getHeader(headers, "references"),
  };
}

// ---------------------------------------------------------------------------
// Send email via Gmail API
// ---------------------------------------------------------------------------

export type GmailSendParams = {
  from:       string;           // the authenticated Gmail address
  to:         string;
  subject:    string;
  text:       string;
  inReplyTo?: string | null;
  references?: string | null;
  gmailThreadId?: string | null; // if set, Gmail groups into same thread
};

export type GmailSendResult =
  | { ok: true;  messageId: string; gmailThreadId: string }
  | { ok: false; error: string };

/**
 * Send an email via the Gmail API using the authenticated user's account.
 * Builds a minimal RFC 2822 MIME message, base64url-encodes it, and posts it.
 */
export async function sendViaGmail(
  accessToken: string,
  params: GmailSendParams,
): Promise<GmailSendResult> {
  const { from, to, subject, text, inReplyTo, references, gmailThreadId } = params;

  // Build RFC 2822 message
  const lines: string[] = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
  ];
  if (inReplyTo)  lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);
  lines.push("", text);

  const raw = Buffer.from(lines.join("\r\n")).toString("base64url");

  const body: Record<string, string> = { raw };
  if (gmailThreadId) body.threadId = gmailThreadId;

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: `Gmail send failed (${res.status}): ${err}` };
  }

  const data = await res.json() as { id: string; threadId: string };
  return { ok: true, messageId: data.id, gmailThreadId: data.threadId };
}

// ---------------------------------------------------------------------------
// Types stored in inboxes.config for gmail provider
// ---------------------------------------------------------------------------

export type GmailInboxConfig = {
  encryptedTokens: string;   // output of encryptTokens()
  historyId?:      string;   // latest Gmail historyId for push sync
  pubsubTopic?:    string;   // e.g. projects/mailmind/topics/gmail-push
};
