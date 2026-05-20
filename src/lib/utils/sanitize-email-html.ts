/**
 * Client-only email HTML sanitiser.
 *
 * Emails arrive as untrusted HTML that may contain scripts, tracking pixels,
 * remote stylesheets, JS-URI links, event handlers, or other hostile content.
 * We render via dangerouslySetInnerHTML, so the HTML MUST be cleaned first.
 *
 * Strategy:
 *   - DOMPurify removes scripts, event handlers, javascript: URIs, etc.
 *   - We additionally strip remote <style> rules from <link> elements and
 *     force links to open in a new tab with noopener/noreferrer.
 *
 * Browser-only — uses the global window/document. Call from a "use client"
 * component, never from a server component.
 */

import DOMPurify from "dompurify";

export function sanitizeEmailHtml(rawHtml: string): string {
  if (typeof window === "undefined") return ""; // belt-and-braces server guard

  const clean = DOMPurify.sanitize(rawHtml, {
    // Strip the dangerous bits — DOMPurify's default deny-list is strong,
    // we only need to layer on what's specifically risky in emails.
    FORBID_TAGS: ["script", "style", "link", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus"],
    // Keep <a> and <img> — but URL schemes are vetted by ALLOWED_URI_REGEXP.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    // Don't keep the whole document, just the body content.
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
  });

  // Force all links to open in a new tab with noopener/noreferrer.
  // DOMPurify can't do this declaratively, so post-process the string.
  return clean.replace(
    /<a\s+([^>]*?)>/gi,
    (_match, attrs: string) => {
      const cleaned = attrs
        .replace(/\starget="[^"]*"/gi, "")
        .replace(/\srel="[^"]*"/gi, "");
      return `<a ${cleaned} target="_blank" rel="noopener noreferrer">`;
    },
  );
}
