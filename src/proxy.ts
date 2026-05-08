import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/** Routes that require authentication */
const isProtectedRoute = createRouteMatcher([
  "/app(.*)",
  "/dashboard(.*)",
  "/api/billing(.*)",
  "/api/app(.*)",
  "/admin(.*)",
  "/api/admin(.*)",
]);

const proxy = clerkMiddleware(async (auth, req) => {
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
      return Response.redirect(loginUrl);
    }
  }
});

export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimization)
     * - favicon.ico   (favicon)
     * - public folder files (images, fonts, etc.)
     * - api/webhooks  (Stripe + Clerk webhooks — unauthenticated)
     * - api/db-test   (Database health check — unauthenticated)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
