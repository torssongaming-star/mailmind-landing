/**
 * Server-side HTML stripper for signatures and other user-supplied HTML.
 *
 * Browser-side rendering still goes through DOMPurify (see
 * sanitize-email-html.ts) — this is defence-in-depth so a hostile signature
 * can never even reach the DB. Adding a new heavy dep (isomorphic-dompurify
 * pulls in jsdom, ~5 MB) just for storage-side sanitisation isn't worth it
 * when the primary defence already runs at render time.
 *
 * Strategy:
 *   - Remove dangerous TAGS entirely (script, iframe, object, embed, style,
 *     link, form, meta, base).
 *   - Strip event-handler attributes (on*=...).
 *   - Strip javascript:/vbscript:/data:text/html URIs in href/src.
 *
 * What we deliberately don't do:
 *   - Full HTML parsing — we accept some false-positive matches inside
 *     attribute values; the browser sanitiser handles edge cases.
 *   - Strip <img> or <a> — signatures legitimately use these.
 */

export function sanitizeHtmlServer(input: string): string {
  if (!input) return "";

  let out = input;

  // Strip dangerous tags including their contents.
  out = out.replace(
    /<(script|iframe|object|embed|style|link|form|meta|base)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    "",
  );
  // Strip self-closing or unclosed variants of the same tags.
  out = out.replace(
    /<(script|iframe|object|embed|style|link|form|meta|base)\b[^>]*\/?>/gi,
    "",
  );

  // Strip event-handler attributes: onclick="...", onload='...', onerror=foo
  out = out.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/\son\w+\s*=\s*[^\s>]+/gi, "");

  // Strip dangerous URI schemes in href/src.
  out = out.replace(
    /(\b(?:href|src|action|formaction|background)\s*=\s*["']?\s*)(?:javascript|vbscript|data:text\/html)\s*:/gi,
    "$1about:blank#blocked-",
  );

  return out;
}
