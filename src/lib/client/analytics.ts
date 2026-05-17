/**
 * Client-side analytics helpers — thin wrapper around posthog-js.
 *
 * Usage in client components:
 *   import { captureEvent } from "@/lib/client/analytics";
 *   captureEvent("landing.cta_clicked", { location: "hero", plan: "team" });
 *
 * Never import this in server components or API routes — use src/lib/analytics.ts instead.
 * No PII — only IDs and non-personal properties.
 */

"use client";

import posthog from "posthog-js";

export type LandingCtaLocation = "hero" | "pricing" | "footer";

export type OnboardingStep =
  | "workspace"
  | "website"
  | "casetypes"
  | "aibehavior"
  | "webhooks";

/** Generic event capture. Falls back silently if PostHog not initialised. */
export function captureEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  try {
    posthog.capture(event, properties);
  } catch {
    // Never throw from analytics
  }
}

// ── Typed event helpers ───────────────────────────────────────────────────────

export function trackCtaClicked(location: LandingCtaLocation, plan?: string): void {
  captureEvent("landing.cta_clicked", { location, ...(plan ? { plan } : {}) });
}

export function trackOnboardingStepStarted(step: OnboardingStep): void {
  captureEvent("onboarding.step_started", { step });
}

export function trackOnboardingStepCompleted(step: OnboardingStep): void {
  captureEvent("onboarding.step_completed", { step });
}

export function trackOnboardingCompleted(
  stepsCompleted: number,
  durationMs: number,
): void {
  captureEvent("onboarding.completed", { stepsCompleted, durationMs });
}

export function trackUpgradeViewed(
  fromPlan: string,
  triggeredBy: "limit" | "manual",
): void {
  captureEvent("upgrade.viewed", { fromPlan, triggeredBy });
}
