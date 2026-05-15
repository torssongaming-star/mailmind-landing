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

export const proxy = clerkMiddleware(async (auth, req) => {
  // Always allow the health check even if it matches /api/admin(.*)
  // because it handles its own ADMIN_HEALTH_SECRET auth.
  if (req.nextUrl.pathname === "/api/admin/health") {
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
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
