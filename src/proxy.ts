import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/** Routes that require authentication */
const isProtectedRoute = createRouteMatcher([
  "/app(.*)",
  "/dashboard(.*)",
  "/api/billing(.*)",
  "/api/app(.*)",
]);

const proxy = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      // Force redirect to /login if not authenticated
      const loginUrl = new URL("/login", req.url);
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
