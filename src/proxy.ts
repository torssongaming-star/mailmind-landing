import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/** Routes that require authentication */
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/api/billing(.*)",
  // Mailmind app — email triage UI + API
  "/app(.*)",
  "/api/app(.*)",
]);

const proxy = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
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
