import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/** Routes that require authentication */
const isProtectedRoute = createRouteMatcher([
  "/app(.*)",
  "/dashboard(.*)",
  "/api/billing(.*)",
  "/api/app(.*)",
  "/admin(.*)",
  "/api/admin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Always allow these admin routes — they use ADMIN_HEALTH_SECRET, not Clerk.
  if (
    req.nextUrl.pathname === "/api/admin/health" ||
    req.nextUrl.pathname === "/api/admin/sentry-test"
  ) {
    return;
  }

  if (isProtectedRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      // Force redirect to /login if not authenticated, preserving search params
      const loginUrl = new URL("/login", req.url);
      loginUrl.search = req.nextUrl.search;
      return NextResponse.redirect(loginUrl);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and obvious static files that definitely exist,
    // but run for everything else to avoid auth() errors on 404s.
    '/((?!_next|static|[^?]*\\.(?:css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
