import nextPlugin from "@next/eslint-plugin-next";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

// ── Import-boundary helpers (§3.4) ───────────────────────────────────────────
// Dependency direction: platform-core → quoting-common → verticals.
// Verticals never import each other; quoting-common never imports verticals;
// platform core never imports quoting-common or any vertical directly.

const VERTICAL_DIRS = ["solar", "construction", "trades"];

/** Patterns that block direct imports of any vertical lib or component. */
const ALL_VERTICAL_PATTERNS = VERTICAL_DIRS.flatMap((v) => [
  {
    group: [`@/lib/${v}`, `@/lib/${v}/**`],
    message: `Import ${v} only via its public API — platform core must not depend on verticals.`,
  },
  {
    group: [`@/components/${v}`, `@/components/${v}/**`],
    message: `Import ${v} components only via their public API — platform core must not depend on verticals.`,
  },
]);

/** Patterns that block direct imports of quoting-common from platform core. */
const QUOTING_COMMON_PATTERNS = [
  {
    group: ["@/lib/quoting-common", "@/lib/quoting-common/**"],
    message: "Platform core must not import quoting-common. Only verticals and quoting-aware modules should.",
  },
  {
    group: ["@/components/quoting-common", "@/components/quoting-common/**"],
    message: "Platform core must not import quoting-common components.",
  },
];

/** Glob sets for vertical source trees (lib + app routes + components). */
function verticalGlobs(v) {
  return [
    `src/lib/${v}/**/*.{ts,tsx}`,
    `src/app/(portal)/${v}/**/*.{ts,tsx}`,
    `src/components/${v}/**/*.{ts,tsx}`,
  ];
}

/** Cross-vertical import patterns for a given vertical (blocks its sibling verticals). */
function crossVerticalPatterns(ownVertical) {
  return VERTICAL_DIRS.filter((v) => v !== ownVertical).flatMap((v) => [
    {
      group: [`@/lib/${v}`, `@/lib/${v}/**`],
      message: `${ownVertical} must not import ${v} — verticals communicate via quoting-common events only.`,
    },
  ]);
}

/** Pattern that blocks direct @/lib/db access (must go via data layer). */
const DB_DIRECT_PATTERN = {
  group: ["@/lib/db", "@/lib/db/**"],
  message: "Vertical routes must access the DB via @/lib/<vertical>/data/* or @/lib/quoting-common/data/*.",
};

const eslintConfig = [
  {
    ignores: [
      "**/.next/**",
      "node_modules/**",
      "out/**",
      "public/**",
      "household-bills/**",
      "*.config.js",
      "*.config.ts",
      ".agents/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  // ── Import boundaries ──────────────────────────────────────────────────────

  // Rule 1: Platform core must not import verticals or quoting-common.
  // Excludes the vertical/quoting-common source trees themselves.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      ...VERTICAL_DIRS.flatMap((v) => [
        `src/lib/${v}/**`,
        `src/app/(portal)/${v}/**`,
        `src/components/${v}/**`,
      ]),
      "src/lib/quoting-common/**",
      "src/components/quoting-common/**",
      "src/app/api/quoting/**",
      // Public, vertical-agnostic quote surfaces are quoting-aware: they read
      // quoting-common only (never a specific vertical's lib).
      "src/app/q/**",
      "src/app/api/public/quote/**",
    ],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [...QUOTING_COMMON_PATTERNS, ...ALL_VERTICAL_PATTERNS],
      }],
    },
  },

  // Rule 3: quoting-common must not import verticals.
  {
    files: [
      "src/lib/quoting-common/**/*.{ts,tsx}",
      "src/components/quoting-common/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": ["error", { patterns: ALL_VERTICAL_PATTERNS }],
    },
  },

  // Rule 2: each vertical must not import sibling verticals (applies to all
  // files in the vertical tree, including data layers).
  ...VERTICAL_DIRS.map((v) => ({
    files: verticalGlobs(v),
    rules: {
      "no-restricted-imports": ["error", {
        patterns: crossVerticalPatterns(v),
      }],
    },
  })),

  // Rule 4: vertical routes/components/engines must not import @/lib/db
  // directly — they must go via @/lib/<vertical>/data/*.
  // Data layer files (src/lib/<v>/data/**) are EXEMPT: they ARE the abstraction.
  ...VERTICAL_DIRS.map((v) => ({
    files: [
      `src/app/(portal)/${v}/**/*.{ts,tsx}`,
      `src/components/${v}/**/*.{ts,tsx}`,
      `src/lib/${v}/engine/**/*.{ts,tsx}`,
    ],
    rules: {
      "no-restricted-imports": ["error", { patterns: [DB_DIRECT_PATTERN] }],
    },
  })),

  // Rule 4 (continued): quoting API routes must not import @/lib/db directly.
  {
    files: ["src/app/api/quoting/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [DB_DIRECT_PATTERN] }],
    },
  },
];

export default eslintConfig;
