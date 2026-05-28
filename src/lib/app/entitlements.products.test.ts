/**
 * hasProductAccess() tests — S0-2.
 *
 * Validates that product access is granted for active/trialing status,
 * denied for disabled, and denied when the row is missing entirely.
 */

import { describe, it, expect } from "vitest";
import { hasProductAccess, type AccountSnapshot } from "./entitlements";

function snap(
  products: AccountSnapshot["products"],
): AccountSnapshot {
  return { products } as AccountSnapshot;
}

describe("hasProductAccess", () => {
  it("returns true when status is active", () => {
    const account = snap({ solar: { status: "active", limits: {} } });
    expect(hasProductAccess(account, "solar")).toBe(true);
  });

  it("returns true when status is trialing", () => {
    const account = snap({ solar: { status: "trialing", limits: {} } });
    expect(hasProductAccess(account, "solar")).toBe(true);
  });

  it("returns false when status is disabled", () => {
    const account = snap({ solar: { status: "disabled", limits: {} } });
    expect(hasProductAccess(account, "solar")).toBe(false);
  });

  it("returns false when the product key is missing", () => {
    const account = snap({});
    expect(hasProductAccess(account, "solar")).toBe(false);
  });

  it("returns false for an unrelated key when another product is active", () => {
    const account = snap({ mail: { status: "active", limits: {} } });
    expect(hasProductAccess(account, "solar")).toBe(false);
  });

  it("empty products object (mock/no-DB mode) returns false", () => {
    const account = snap({});
    expect(hasProductAccess(account, "mail")).toBe(false);
  });
});
