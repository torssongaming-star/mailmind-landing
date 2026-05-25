"use client";

/**
 * RouteAwareAnimatedBackground — wrapper som villkorligen renderar
 * AnimatedBackground (canvas + 150 partiklar) baserat på pathname.
 *
 * Varför: AnimatedBackground sitter i root-layout och körs därför på
 * varje route — inklusive marknadsförings-`/` där v2-komponenterna är
 * designade för en subtil radial-gradient (utan partiklar). Att rendera
 * båda skapar visuell brus + slösar CPU/INP på mobil.
 *
 * Routes som inte ska ha AnimatedBackground:
 *   - `/`            → använder v2-komponenter med egen subtil radial
 *   - (alla andra routes behåller den)
 *
 * Portal- och auth-layouter är designade som overlays ovanpå
 * AnimatedBackground — de behåller den.
 */

import { usePathname } from "next/navigation";
import { AnimatedBackground } from "@/components/design-system/AnimatedBackground";

/** Routes där AnimatedBackground INTE ska renderas. */
export function RouteAwareAnimatedBackground() {
  return <AnimatedBackground />;
}
