/**
 * Next.js middleware — Clerk authentication layer.
 *
 * clerkMiddleware() must run on every request that may call auth() or
 * currentUser() in a server component/route handler. Without it, Clerk
 * throws error 2666719741.
 *
 * Route strategy:
 *   - /app/*          → always protected (redirect to /login if unauthenticated)
 *   - /dashboard/*    → always protected
 *   - /api/app/*      → always protected (401 if unauthenticated)
 *   - /api/billing/*  → always protected
 *   - everything else → public (Clerk still provides auth context, just
 *                       doesn't redirect)
 *
 * Webhooks (/api/webhooks/*) and the public demo API (/api/public/*) are
 * intentionally left public — they have their own verification (HMAC / rate-limit).
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/app(.*)",
  "/dashboard(.*)",
  "/api/app(.*)",
  "/api/billing(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
