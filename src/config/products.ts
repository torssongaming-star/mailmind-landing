/**
 * Platform product registry — client-safe, no server imports.
 *
 * Lists every vertical the platform knows about. Activation per tenant is
 * controlled by `org_product_access` in the DB; this file is the source of
 * truth for metadata (display name, nav icon, feature-flag readiness).
 *
 * Keep the full PlatformVertical contract minimal here — we grow it as each
 * phase needs it (S1 adds engine/data, S4 adds PDF, etc.).
 */

// ── Type ──────────────────────────────────────────────────────────────────────

export type PlatformVertical = {
  /** Stable key — matches `products.key` in the DB and `org_product_access.product_key`. */
  key: string;
  /** Human-readable name shown in the workspace switcher and headings. */
  displayName: string;
  /** Lucide icon name (or similar string token) used by the nav switcher. */
  navIcon: string;
  /**
   * False for all verticals — tenants must be explicitly provisioned via
   * `org_product_access`. There is no "install yourself" flow yet.
   */
  enabledByDefault: false;
  /**
   * When true the vertical is not yet built and must not be rendered in nav
   * or route guards. Flip to undefined/false when the phase ships.
   */
  placeholder?: true;
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const PRODUCTS = {
  mail: {
    key:              "mail",
    displayName:      "Mail",
    navIcon:          "Mail",
    enabledByDefault: false,
  },
  solar: {
    key:              "solar",
    displayName:      "Solar",
    navIcon:          "Sun",
    enabledByDefault: false,
  },
  construction: {
    key:              "construction",
    displayName:      "Construction",
    navIcon:          "HardHat",
    enabledByDefault: false,
  },
  trades: {
    key:              "trades",
    displayName:      "Trades",
    navIcon:          "Wrench",
    enabledByDefault: false,
    placeholder:      true,
  },
} as const satisfies Record<string, PlatformVertical>;

export type ProductKey = keyof typeof PRODUCTS;
