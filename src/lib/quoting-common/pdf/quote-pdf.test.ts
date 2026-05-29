import { describe, it, expect } from "vitest";
import { renderQuotePdf } from "./quote-pdf";

describe("renderQuotePdf", () => {
  const base = {
    orgName: "Solbolaget AB",
    quoteNumber: "OFF-2026-0007",
    dateLabel: "2026-05-29",
    customerName: "Anna Andersson",
    customerEmail: "anna@example.se",
    heading: "Offert — Solcellsanläggning",
    footer: "Solbolaget AB",
  };

  it("produces a valid PDF buffer with header and EOF", () => {
    const pdf = renderQuotePdf(base);
    expect(Buffer.isBuffer(pdf)).toBe(true);
    const head = pdf.subarray(0, 8).toString("latin1");
    expect(head).toBe("%PDF-1.4");
    expect(pdf.toString("latin1")).toContain("%%EOF");
  });

  it("includes a valid xref table and trailer", () => {
    const s = renderQuotePdf(base).toString("latin1");
    expect(s).toContain("xref");
    expect(s).toContain("trailer");
    expect(s).toContain("startxref");
    expect(s).toContain("/Root 1 0 R");
  });

  it("escapes parentheses in text without breaking structure", () => {
    const pdf = renderQuotePdf({ ...base, narrative: "Tack (verkligen) för förtroendet!" });
    const s = pdf.toString("latin1");
    expect(s).toContain("\\(verkligen\\)");
  });

  it("renders figures and totals rows", () => {
    const pdf = renderQuotePdf({
      ...base,
      figures: [{ label: "Årlig besparing", value: "12 000 kr" }],
      totals: [{ label: "Att betala", value: "86 900 kr", bold: true }],
    });
    const s = pdf.toString("latin1");
    expect(s).toContain("Tj"); // at least one text-show operator
    expect(s).toContain("/F2"); // bold font referenced for the bold total
  });

  it("handles empty optional sections", () => {
    const pdf = renderQuotePdf(base);
    expect(pdf.length).toBeGreaterThan(200);
  });
});
