"use client";

import { MotionConfig } from "framer-motion";

/**
 * Wraps the app with Framer Motion's MotionConfig to globally respect
 * the user's prefers-reduced-motion system preference.
 * When the user has reduced motion enabled, all Framer Motion animations
 * are automatically disabled or simplified.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  );
}
