/**
 * autoSend.ts tests — canAutoSend() and executeSendDraft().
 *
 * canAutoSend() is the *security perimeter* for auto-sent AI replies. Any
 * regression that lets a draft through without all 6 conditions met is an
 * immediate brand/security incident. These tests are MANDATORY in CI.
 *
 * Locked rules (all must pass):
 *   1. confidence ≥ 0.90
 *   2. source_grounded === true
 *   3. risk_level === "low"
 *   4. action !== "escalate"
 *   5. interactionCount ≥ 3 (not a brand-new customer)
 *   6. !isBlocked (sender not manually blocked)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  canAutoSend,
  executeSendDraft,
  AUTO_SEND_CONFIDENCE_THRESHOLD,
  type AutoSendParams,
} from "./autoSend";

// ── Hoisted mock state ────────────────────────────────────────────────────────
// vi.hoisted() runs before vi.mock() factories — the only safe way to share
// mutable state between a factory closure and test code.
const { mockDbLimit, mockIsDbConnected, mockClaimReturning } = vi.hoisted(() => ({
  mockDbLimit:         vi.fn().mockResolvedValue([]),
  mockIsDbConnected:   vi.fn(() => true),
  // Controls the atomic claim UPDATE...RETURNING — returning [] means
  // "already claimed by someone else", returning [draftRow] means "we got it".
  mockClaimReturning:  vi.fn().mockResolvedValue([]),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => ({
  isDbConnected: mockIsDbConnected,
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: mockDbLimit }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({ returning: mockClaimReturning }),
      }),
    }),
  },
  inboxes: {},
  aiDrafts: {
    id:             { name: "id" },
    organizationId: { name: "organization_id" },
    status:         { name: "status" },
  },
  users: {
    id: { name: "id" },
  },
}));

vi.mock("@/lib/app/threads", () => ({
  getDraft:            vi.fn(),
  getThread:           vi.fn(),
  listMessages:        vi.fn().mockResolvedValue([]),
  getAiSettings:       vi.fn().mockResolvedValue(null),
  appendMessage:       vi.fn().mockResolvedValue(undefined),
  updateDraft:         vi.fn().mockResolvedValue(undefined),
  updateThread:        vi.fn().mockResolvedValue(undefined),
  setThreadExternalId: vi.fn().mockResolvedValue(undefined),
  updateInboxConfig:   vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/app/email", () => ({
  sendEmail:           vi.fn().mockResolvedValue({ ok: true, id: "resend-123" }),
  replySubject:        vi.fn((s: string) => `Re: ${s}`),
  appendSignature:     vi.fn((body: string) => body),
  appendHtmlSignature: vi.fn((html: string) => html),
}));

vi.mock("@/lib/utils/html", () => ({
  textToHtml: vi.fn((s: string) => `<p>${s}</p>`),
  htmlToText: vi.fn((s: string) => s),
}));

vi.mock("@/lib/app/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/app/gmail", () => ({
  decryptTokens:       vi.fn().mockReturnValue({ accessToken: "a", refreshToken: "r" }),
  encryptTokens:       vi.fn().mockReturnValue("enc"),
  getValidAccessToken: vi.fn().mockResolvedValue({ token: "gmail-tok", updated: null }),
  sendViaGmail:        vi.fn().mockResolvedValue({ ok: true, messageId: "gm-1", gmailThreadId: "gt-1" }),
}));

vi.mock("@/lib/app/outlook", () => ({
  decryptTokens:       vi.fn().mockReturnValue({ accessToken: "a", refreshToken: "r" }),
  encryptTokens:       vi.fn().mockReturnValue("enc"),
  getValidAccessToken: vi.fn().mockResolvedValue({ token: "outlook-tok", updated: null }),
  sendViaOutlook:      vi.fn().mockResolvedValue({ ok: true, messageId: "om-1" }),
}));

// ── Imported mock refs ────────────────────────────────────────────────────────
import { getDraft, getThread } from "@/lib/app/threads";
import { sendEmail } from "@/lib/app/email";
import { sendViaGmail } from "@/lib/app/gmail";
import { sendViaOutlook } from "@/lib/app/outlook";

// ═══════════════════════════════════════════════════════════════════════════════
// canAutoSend() tests
// ═══════════════════════════════════════════════════════════════════════════════

/** Base params that PASS — change one field per test to verify the gate. */
const passing: AutoSendParams = {
  action:           "summarize",
  confidence:       0.95,
  riskLevel:        "low",
  sourceGrounded:   true,
  interactionCount: 5,
  isBlocked:        false,
};

describe("canAutoSend — happy path", () => {
  it("allows when all 6 conditions met", () => {
    const result = canAutoSend(passing);
    expect(result.eligible).toBe(true);
  });

  it("allows at exactly the confidence threshold (0.90)", () => {
    const result = canAutoSend({ ...passing, confidence: AUTO_SEND_CONFIDENCE_THRESHOLD });
    expect(result.eligible).toBe(true);
  });

  it("allows at exactly interactionCount = 3", () => {
    const result = canAutoSend({ ...passing, interactionCount: 3 });
    expect(result.eligible).toBe(true);
  });
});

describe("canAutoSend — rule 1: confidence ≥ 0.90", () => {
  it("blocks confidence = 0.89", () => {
    const r = canAutoSend({ ...passing, confidence: 0.89 });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.blockers.some(b => b.startsWith("confidence_too_low"))).toBe(true);
  });

  it("blocks confidence = 0.5", () => {
    const r = canAutoSend({ ...passing, confidence: 0.5 });
    expect(r.eligible).toBe(false);
  });

  it("blocks confidence = 0", () => {
    const r = canAutoSend({ ...passing, confidence: 0 });
    expect(r.eligible).toBe(false);
  });
});

describe("canAutoSend — rule 2: source_grounded", () => {
  it("blocks when sourceGrounded = false", () => {
    const r = canAutoSend({ ...passing, sourceGrounded: false });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.blockers).toContain("not_source_grounded");
  });
});

describe("canAutoSend — rule 3: risk_level = low", () => {
  it("blocks risk_level = medium", () => {
    const r = canAutoSend({ ...passing, riskLevel: "medium" });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.blockers).toContain("risk_level_medium");
  });

  it("blocks risk_level = high", () => {
    const r = canAutoSend({ ...passing, riskLevel: "high" });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.blockers).toContain("risk_level_high");
  });
});

describe("canAutoSend — rule 4: action !== escalate", () => {
  it("blocks action = escalate", () => {
    const r = canAutoSend({ ...passing, action: "escalate" });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.blockers).toContain("action_is_escalate");
  });

  it("allows action = ask (if everything else passes)", () => {
    const r = canAutoSend({ ...passing, action: "ask" });
    expect(r.eligible).toBe(true);
  });
});

describe("canAutoSend — rule 5: interactionCount ≥ 3", () => {
  it("blocks interactionCount = 0", () => {
    const r = canAutoSend({ ...passing, interactionCount: 0 });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.blockers.some(b => b.startsWith("new_customer"))).toBe(true);
  });

  it("blocks interactionCount = 2", () => {
    const r = canAutoSend({ ...passing, interactionCount: 2 });
    expect(r.eligible).toBe(false);
  });
});

describe("canAutoSend — rule 6: sender not blocked", () => {
  it("blocks when isBlocked = true", () => {
    const r = canAutoSend({ ...passing, isBlocked: true });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.blockers).toContain("sender_blocked");
  });
});

describe("canAutoSend — multiple failures", () => {
  it("reports all 6 blockers simultaneously — none suppressed", () => {
    const r = canAutoSend({
      confidence:       0.5,
      sourceGrounded:   false,
      riskLevel:        "high",
      action:           "escalate",
      interactionCount: 1,
      isBlocked:        true,
    });
    expect(r.eligible).toBe(false);
    if (!r.eligible) {
      // Exactly 6: confidence_too_low, not_source_grounded, risk_level_high,
      // action_is_escalate, new_customer, sender_blocked
      expect(r.blockers).toHaveLength(6);
      expect(r.blockers.some(b => b.startsWith("confidence_too_low"))).toBe(true);
      expect(r.blockers).toContain("not_source_grounded");
      expect(r.blockers).toContain("risk_level_high");
      expect(r.blockers).toContain("action_is_escalate");
      expect(r.blockers.some(b => b.startsWith("new_customer"))).toBe(true);
      expect(r.blockers).toContain("sender_blocked");
    }
  });
});

describe("canAutoSend — locked threshold values", () => {
  it("AUTO_SEND_CONFIDENCE_THRESHOLD is exactly 0.90", () => {
    // If this constant changes, a senior reviewer MUST sign off.
    // The product promise is "≥ 90%". Loosening this is a customer-facing
    // change to the GTM contract.
    expect(AUTO_SEND_CONFIDENCE_THRESHOLD).toBe(0.90);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// executeSendDraft() tests — provider routing
// ═══════════════════════════════════════════════════════════════════════════════

// Minimal fixtures
const baseDraft = {
  id:       "d-1",
  status:   "pending",
  action:   "summarize",
  bodyText: "Hello there",
  threadId: "t-1",
  metadata: {},
} as const;

const baseThread = {
  id:               "t-1",
  organizationId:   "org-1",
  inboxId:          null as string | null,
  fromEmail:        "customer@example.com",
  subject:          "Need help",
  externalThreadId: null as string | null,
  status:           "open",
  interactionCount: 3,
  caseTypeSlug:     null,
  collectedInfo:    null,
};

const gmailInboxRow = {
  id:       "inbox-g",
  email:    "support@company.com",
  provider: "gmail",
  config:   { encryptedTokens: "enc-tok" },
};

const outlookInboxRow = {
  id:       "inbox-o",
  email:    "support@company.com",
  provider: "outlook",
  config:   { encryptedTokens: "enc-tok" },
};

const mailmindInboxRow = {
  id:       "inbox-m",
  email:    "support@mail.mailmind.se",
  provider: "mailmind",
  config:   {},
};

describe("executeSendDraft — error paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDbConnected.mockReturnValue(true);
    mockDbLimit.mockResolvedValue([]);
    // Default: claim succeeds with baseDraft (each test overrides as needed)
    mockClaimReturning.mockResolvedValue([baseDraft]);
  });

  it("returns db_unavailable when DB not connected", async () => {
    mockIsDbConnected.mockReturnValue(false);
    const r = await executeSendDraft({ orgId: "org-1", draftId: "d-1", userId: null });
    expect(r).toEqual({ ok: false, error: "db_unavailable" });
  });

  it("returns draft_not_found when getDraft resolves null", async () => {
    // Claim fails (0 rows), getDraft also returns null → draft_not_found
    mockClaimReturning.mockResolvedValue([]);
    vi.mocked(getDraft).mockResolvedValue(null);
    const r = await executeSendDraft({ orgId: "org-1", draftId: "d-1", userId: null });
    expect(r).toEqual({ ok: false, error: "draft_not_found" });
  });

  it("returns draft_already_sent when draft.status is sent", async () => {
    // Claim fails (only pending/edited can be claimed), getDraft reveals status=sent
    mockClaimReturning.mockResolvedValue([]);
    vi.mocked(getDraft).mockResolvedValue({ ...baseDraft, status: "sent" } as never);
    const r = await executeSendDraft({ orgId: "org-1", draftId: "d-1", userId: null });
    expect(r).toEqual({ ok: false, error: "draft_already_sent" });
  });

  it("returns draft_already_rejected when draft.status is rejected", async () => {
    mockClaimReturning.mockResolvedValue([]);
    vi.mocked(getDraft).mockResolvedValue({ ...baseDraft, status: "rejected" } as never);
    const r = await executeSendDraft({ orgId: "org-1", draftId: "d-1", userId: null });
    expect(r).toEqual({ ok: false, error: "draft_already_rejected" });
  });

  it("returns no_body_text when bodyText is empty", async () => {
    // Claim succeeds, but body is empty → bail with no_body_text
    mockClaimReturning.mockResolvedValue([{ ...baseDraft, bodyText: "" }]);
    vi.mocked(getThread).mockResolvedValue({ ...baseThread } as never);
    const r = await executeSendDraft({ orgId: "org-1", draftId: "d-1", userId: null });
    expect(r).toEqual({ ok: false, error: "no_body_text" });
  });
});

describe("executeSendDraft — provider routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDbConnected.mockReturnValue(true);
    mockDbLimit.mockResolvedValue([]);
    // Claim succeeds with baseDraft for these happy-path tests
    mockClaimReturning.mockResolvedValue([baseDraft]);
    vi.mocked(getDraft).mockResolvedValue(baseDraft as never);
  });

  it("calls sendEmail (Resend) when thread has no inboxId", async () => {
    vi.mocked(getThread).mockResolvedValue({ ...baseThread, inboxId: null } as never);

    const r = await executeSendDraft({ orgId: "org-1", draftId: "d-1", userId: "u-1" });

    expect(r.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendViaGmail).not.toHaveBeenCalled();
    expect(sendViaOutlook).not.toHaveBeenCalled();
  });

  it("calls sendEmail (Resend) when inbox provider is mailmind", async () => {
    vi.mocked(getThread).mockResolvedValue({ ...baseThread, inboxId: "inbox-m" } as never);
    mockDbLimit.mockResolvedValue([mailmindInboxRow]);

    const r = await executeSendDraft({ orgId: "org-1", draftId: "d-1", userId: "u-1" });

    expect(r.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendViaGmail).not.toHaveBeenCalled();
    expect(sendViaOutlook).not.toHaveBeenCalled();
  });

  it("calls sendViaGmail when inbox provider is gmail", async () => {
    vi.mocked(getThread).mockResolvedValue({ ...baseThread, inboxId: "inbox-g" } as never);
    mockDbLimit.mockResolvedValue([gmailInboxRow]);

    const r = await executeSendDraft({ orgId: "org-1", draftId: "d-1", userId: null });

    expect(r.ok).toBe(true);
    expect(sendViaGmail).toHaveBeenCalledOnce();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendViaOutlook).not.toHaveBeenCalled();
  });

  it("calls sendViaOutlook when inbox provider is outlook", async () => {
    vi.mocked(getThread).mockResolvedValue({ ...baseThread, inboxId: "inbox-o" } as never);
    mockDbLimit.mockResolvedValue([outlookInboxRow]);

    const r = await executeSendDraft({ orgId: "org-1", draftId: "d-1", userId: null });

    expect(r.ok).toBe(true);
    expect(sendViaOutlook).toHaveBeenCalledOnce();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendViaGmail).not.toHaveBeenCalled();
  });

  it("escalation draft: skips send entirely, transitions thread to escalated", async () => {
    mockClaimReturning.mockResolvedValue([{ ...baseDraft, action: "escalate" }]);
    vi.mocked(getThread).mockResolvedValue({ ...baseThread } as never);
    const { updateDraft, updateThread } = await import("@/lib/app/threads");

    const r = await executeSendDraft({ orgId: "org-1", draftId: "d-1", userId: null });

    expect(r.ok).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendViaGmail).not.toHaveBeenCalled();
    expect(sendViaOutlook).not.toHaveBeenCalled();
    expect(vi.mocked(updateThread)).toHaveBeenCalledWith(
      "org-1",
      "t-1",
      expect.objectContaining({ status: "escalated" }),
    );
    expect(vi.mocked(updateDraft)).toHaveBeenCalledWith(
      "org-1",
      "d-1",
      expect.objectContaining({ status: "sent" }),
    );
  });

  it("summarize draft transitions thread to resolved", async () => {
    vi.mocked(getThread).mockResolvedValue({ ...baseThread, inboxId: null } as never);
    const { updateThread } = await import("@/lib/app/threads");

    await executeSendDraft({ orgId: "org-1", draftId: "d-1", userId: null });

    expect(vi.mocked(updateThread)).toHaveBeenCalledWith(
      "org-1",
      "t-1",
      expect.objectContaining({ status: "resolved" }),
    );
  });

  it("propagates gmail send failure as ok: false", async () => {
    vi.mocked(getThread).mockResolvedValue({ ...baseThread, inboxId: "inbox-g" } as never);
    mockDbLimit.mockResolvedValue([gmailInboxRow]);
    const { sendViaGmail: gmailSend } = await import("@/lib/app/gmail");
    vi.mocked(gmailSend).mockResolvedValue({ ok: false, error: "auth_error" } as never);

    const r = await executeSendDraft({ orgId: "org-1", draftId: "d-1", userId: null });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("gmail_send_error");
  });
});
