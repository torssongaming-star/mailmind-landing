"use client";

import { useEffect } from "react";

/**
 * Deferred PostHog initialiser.
 *
 * Why this component exists:
 *   PostHog used to be initialised eagerly during hydration in Providers.tsx,
 *   which dominated the page's INP budget (≈1.5–2.5s on mobile). We now defer
 *   the init to the browser's idle time and dynamically import posthog-js so
 *   it stays out of the initial JS bundle.
 *
 * Behaviour:
 *   - SSR-safe (mount-only effect; no `if (typeof window)` gating needed).
 *   - No-op if NEXT_PUBLIC_POSTHOG_KEY is missing.
 *   - Other modules that import `posthog-js` directly (e.g. event capture in
 *     click handlers) keep working — once init runs, the singleton is shared.
 *     If a capture fires before init completes it silently no-ops, which is
 *     fine for our usage (all captures are inside user interactions).
 *
 * GDPR / privacy settings mirror the previous eager init exactly:
 *   - EU host (eu.i.posthog.com / eu.posthog.com)
 *   - respect_dnt
 *   - identified_only person profiles
 *   - sanitize_properties drops anything that looks like an email address
 */
export function PostHogClient(): null {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!key || !host) return;

    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const initPostHog = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const posthog = (await import("posthog-js")).default;
        if (cancelled) return;
        posthog.init(key, {
          api_host:            host,
          ui_host:             "https://eu.posthog.com",
          capture_pageview:    false, // Next.js App Router handles routing; fire manually if needed
          capture_pageleave:   false,
          respect_dnt:         true,
          persistence:         "localStorage+cookie",
          person_profiles:     "identified_only",
          sanitize_properties: (props) => {
            // Extra guard: strip any field that looks like an email address
            const clean: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(props)) {
              if (typeof v === "string" && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(v)) continue;
              clean[k] = v;
            }
            return clean;
          },
        });
      } catch {
        // Analytics must never break the app
      }
    };

    if ("requestIdleCallback" in window) {
      idleHandle = window.requestIdleCallback(() => {
        void initPostHog();
      });
    } else {
      timeoutHandle = setTimeout(() => {
        void initPostHog();
      }, 1);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    };
  }, []);

  return null;
}
