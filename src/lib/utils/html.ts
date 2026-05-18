/**
 * HTML and Plain Text conversion utilities.
 * Used for formatting emails before sending them via Gmail/Outlook/Resend.
 */

/**
 * Converts rich HTML content to plain text.
 * Simple but sufficient for generating the text/plain fallback part of an email.
 */
export function htmlToText(html: string): string {
  if (!html) return "";
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

/**
 * Converts plain text into safe HTML, replacing newlines with <br> tags.
 * Used for converting AI text drafts into HTML bodies before appending HTML signatures.
 */
export function textToHtml(text: string): string {
  if (!text) return "";
  // Escape HTML entities to prevent injection
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  // Replace newlines with <br> tags
  return escaped.replace(/\n/g, "<br/>");
}
