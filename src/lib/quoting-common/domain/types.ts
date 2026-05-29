/**
 * Quoting-common domain types.
 *
 * Pure TypeScript — no Drizzle imports, no server-only code.
 * Client-safe: can be imported from both server components and client islands.
 *
 * These mirror the DB inferred types in `src/lib/db/schema.quoting.ts` but are
 * deliberately kept separate so the domain layer has no dependency on the ORM.
 */

// ── Status enums ──────────────────────────────────────────────────────────────

export type PriceBookStatus = "draft" | "published" | "archived";

export type QuoteStatus =
  | "draft"
  | "calculating"
  | "ready"
  | "sent"
  | "viewed"
  | "accepted"
  | "signed"
  | "rejected"
  | "expired";

// ── Customer ──────────────────────────────────────────────────────────────────

export type CustomerAddress = {
  street?:     string;
  city?:       string;
  postalCode?: string;
  country?:    string;
};

export type Customer = {
  id:              string;
  organizationId:  string;
  name:            string;
  orgNumber:       string | null;
  email:           string | null;
  phone:           string | null;
  address:         CustomerAddress | null;
  sharedContactId: string | null;
  meta:            Record<string, unknown>;
  createdAt:       Date;
  updatedAt:       Date;
};

export type CreateCustomerInput = {
  name:           string;
  orgNumber?:     string;
  email?:         string;
  phone?:         string;
  address?:       CustomerAddress;
  meta?:          Record<string, unknown>;
};

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

// ── Product ───────────────────────────────────────────────────────────────────

export type Product = {
  id:             string;
  organizationId: string;
  kind:           string;
  verticals:      string[];
  sku:            string | null;
  name:           string;
  spec:           Record<string, unknown> | null;
  cost:           string | null; // numeric from DB comes as string
  active:         boolean;
  createdAt:      Date;
  updatedAt:      Date;
};

// ── PriceBook ─────────────────────────────────────────────────────────────────

export type PriceBook = {
  id:             string;
  organizationId: string;
  name:           string;
  currency:       string;
  status:         PriceBookStatus;
  verticals:      string[];
  createdAt:      Date;
  updatedAt:      Date;
};

export type PriceBookVersionItems = Record<string, {
  unitPrice?:  number;
  laborRate?:  number;
  vatRate?:    number;
  rotRate?:    number;
  rutRate?:    number;
  [key: string]: unknown;
}>;

export type PriceBookVersion = {
  id:             string;
  organizationId: string;
  priceBookId:    string;
  version:        number;
  effectiveFrom:  string; // ISO date string
  items:          PriceBookVersionItems;
  publishedAt:    Date | null;
  createdBy:      string | null;
};

// ── Quote ─────────────────────────────────────────────────────────────────────

export type Quote = {
  id:                 string;
  organizationId:     string;
  customerId:         string | null;
  vertical:           string;
  number:             string | null;
  status:             QuoteStatus;
  priceBookVersionId: string | null;
  currency:           string;
  subtotal:           string | null; // numeric → string
  vatAmount:          string | null;
  rotDeduction:       string | null;
  rutDeduction:       string | null;
  total:              string | null;
  validUntil:         string | null; // ISO date string
  assignedUserId:     string | null;
  meta:               Record<string, unknown> | null;
  createdBy:          string | null;
  createdAt:          Date;
  updatedAt:          Date;
};

export type CreateQuoteInput = {
  vertical:            string;
  customerId?:         string;
  priceBookVersionId?: string;
  validUntil?:         string;
  meta?:               Record<string, unknown>;
};

export type UpdateQuoteInput = Partial<{
  customerId:          string | null;
  status:              QuoteStatus;
  priceBookVersionId:  string | null;
  currency:            string;
  subtotal:            string;
  vatAmount:           string;
  rotDeduction:        string;
  rutDeduction:        string;
  total:               string;
  validUntil:          string | null;
  assignedUserId:      string | null;
  meta:                Record<string, unknown>;
}>;

// ── QuoteLine ─────────────────────────────────────────────────────────────────

export type QuoteLine = {
  id:             string;
  organizationId: string;
  quoteId:        string;
  productId:      string | null;
  description:    string;
  qty:            string; // numeric → string
  unitPrice:      string;
  lineTotal:      string;
  sortOrder:      number;
  meta:           Record<string, unknown> | null;
};

export type UpsertQuoteLineInput = {
  productId?:   string;
  description:  string;
  qty:          number;
  unitPrice:    number;
  sortOrder?:   number;
  meta?:        Record<string, unknown>;
};

// ── WorkflowEvent ─────────────────────────────────────────────────────────────

export type WorkflowEvent = {
  id:             string;
  organizationId: string;
  quoteId:        string;
  fromStage:      string | null;
  toStage:        string;
  actorUserId:    string | null;
  reason:         string | null;
  createdAt:      Date;
};

export type AppendWorkflowEventInput = {
  fromStage?:  string;
  toStage:     string;
  actorUserId?: string;
  reason?:     string;
};
