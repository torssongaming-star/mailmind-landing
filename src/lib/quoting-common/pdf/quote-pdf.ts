/**
 * Minimal, dependency-free PDF generator for customer quote documents.
 *
 * Why hand-rolled instead of a library: the lightweight renderers (pdfkit etc.)
 * ship font-metric (.afm) data that Next.js file-tracing frequently fails to
 * bundle on Vercel serverless, causing runtime ENOENT. A quote is plain text +
 * simple tables, so we emit a minimal PDF using the base-14 Helvetica font
 * (no embedding, no external files) with WinAnsi encoding (covers å/ä/ö).
 *
 * Layout is intentionally simple: a single page, top-down text lines with a few
 * styles (title, heading, body, right-aligned amounts). No wrapping engine —
 * long lines are truncated to a safe column width. This is a delivery artifact,
 * not a typesetting system; the interactive /q link remains the rich surface.
 *
 * Pure function: returns a Buffer. No I/O, no DB.
 */

const PAGE_W = 595; // A4 width in PDF points
const PAGE_H = 842; // A4 height
const MARGIN = 56;
const LINE = 16;
const MAX_CHARS = 90; // safe truncation for 11pt Helvetica within margins

type Line =
  | { kind: "title"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "body"; text: string }
  | { kind: "row"; left: string; right: string; bold?: boolean }
  | { kind: "gap" };

export type QuotePdfInput = {
  orgName:     string;
  quoteNumber: string;
  dateLabel:   string;
  customerName: string;
  customerEmail?: string | null;
  heading:     string;          // e.g. "Offert — Solcellsanläggning"
  narrative?:  string;
  figures?:    Array<{ label: string; value: string }>;
  lines?:      Array<{ description: string; qty: number; unitPrice: string; lineTotal: string }>;
  totals?:     Array<{ label: string; value: string; bold?: boolean }>;
  included?:   Array<{ title: string; body: string }>;
  validLabel?: string | null;   // e.g. "Offerten gäller till och med 2026-06-30."
  footer:      string;
};

// ── PDF text escaping + WinAnsi byte encoding ─────────────────────────────────

/** Escape PDF string special chars. */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function clamp(s: string, max = MAX_CHARS): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// ── Build the ordered line list from structured input ─────────────────────────

function buildLines(input: QuotePdfInput): Line[] {
  const out: Line[] = [];
  out.push({ kind: "title", text: input.heading });
  out.push({ kind: "body", text: `${input.orgName}` });
  out.push({ kind: "row", left: `Offert ${input.quoteNumber}`, right: input.dateLabel });
  out.push({ kind: "gap" });

  out.push({ kind: "heading", text: "Kund" });
  out.push({ kind: "body", text: input.customerName });
  if (input.customerEmail) out.push({ kind: "body", text: input.customerEmail });
  out.push({ kind: "gap" });

  if (input.narrative?.trim()) {
    for (const para of input.narrative.split(/\n+/)) {
      // wrap by words into MAX_CHARS chunks
      let cur = "";
      for (const word of para.split(/\s+/)) {
        if ((cur + " " + word).trim().length > MAX_CHARS) {
          if (cur) out.push({ kind: "body", text: cur.trim() });
          cur = word;
        } else {
          cur = (cur + " " + word).trim();
        }
      }
      if (cur) out.push({ kind: "body", text: cur.trim() });
    }
    out.push({ kind: "gap" });
  }

  if (input.figures?.length) {
    out.push({ kind: "heading", text: "Sammanfattning" });
    for (const f of input.figures) out.push({ kind: "row", left: f.label, right: f.value });
    out.push({ kind: "gap" });
  }

  if (input.lines?.length) {
    out.push({ kind: "heading", text: "Specifikation" });
    for (const l of input.lines) {
      out.push({ kind: "row", left: clamp(`${l.description}  (${l.qty} × ${l.unitPrice} kr)`, 70), right: `${l.lineTotal} kr` });
    }
    out.push({ kind: "gap" });
  }

  if (input.totals?.length) {
    for (const t of input.totals) out.push({ kind: "row", left: t.label, right: t.value, bold: t.bold });
    out.push({ kind: "gap" });
  }

  if (input.included?.length) {
    out.push({ kind: "heading", text: "Vad som ingår" });
    for (const e of input.included) out.push({ kind: "body", text: clamp(`• ${e.title}: ${e.body}`) });
    out.push({ kind: "gap" });
  }

  if (input.validLabel) {
    out.push({ kind: "body", text: input.validLabel });
    out.push({ kind: "gap" });
  }

  out.push({ kind: "body", text: input.footer });
  return out;
}

// ── Content stream ────────────────────────────────────────────────────────────

function contentStream(lines: Line[]): string {
  let y = PAGE_H - MARGIN;
  const ops: string[] = [];

  const draw = (text: string, x: number, size: number, bold: boolean) => {
    const font = bold ? "F2" : "F1";
    ops.push(`BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${esc(text)}) Tj ET`);
  };

  for (const ln of lines) {
    if (y < MARGIN + LINE) break; // single page — stop if we run out of room
    switch (ln.kind) {
      case "title":   draw(clamp(ln.text, 60), MARGIN, 18, true); y -= LINE * 1.6; break;
      case "heading": draw(clamp(ln.text, 60), MARGIN, 11, true); y -= LINE; break;
      case "body":    draw(clamp(ln.text), MARGIN, 10, false); y -= LINE; break;
      case "row":
        draw(clamp(ln.left, 60), MARGIN, 10, !!ln.bold);
        draw(ln.right, PAGE_W - MARGIN - ln.right.length * 6, 10, !!ln.bold);
        y -= LINE;
        break;
      case "gap":     y -= LINE * 0.6; break;
    }
  }
  return ops.join("\n");
}

// ── Assemble the PDF document (objects + xref) ────────────────────────────────

export function renderQuotePdf(input: QuotePdfInput): Buffer {
  const stream = contentStream(buildLines(input));
  const streamBytes = Buffer.from(stream, "latin1");

  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  objects[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`;
  objects[4] = `<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`;
  objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[6] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i <= 6; i++) {
    offsets[i] = Buffer.byteLength(pdf, "latin1");
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 7\n0000000000 65535 f \n`;
  for (let i = 1; i <= 6; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}
