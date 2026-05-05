/**
 * (app) route group layout — protects all /app/* routes.
 *
 * Redirect logic (server-side, runs on every request):
 *   1. Not authenticated     → /login
 *   2. Authenticated but not in DB → /app/onboarding (explicit setup step)
 *   3. Authenticated + in DB → render children (the app UI)
 *
 * Note: Clerk middleware (proxy.ts) ALSO blocks unauthenticated requests at
 * the edge. The redirect here is a defence-in-depth check + handles the
 * "user exists in Clerk but not in our DB" case which middleware can't see.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defence in depth — Clerk middleware (proxy.ts) blocks unauthenticated
  // requests at the edge, but we re-check here so server components below
  // can rely on the user being present.
  const { userId } = await auth();
  const clerkUser = await currentUser();

  if (!userId || !clerkUser) {
    redirect("/login");
  }

  // Note: this layout wraps BOTH /app/page.tsx and /app/onboarding/page.tsx.
  // To avoid redirect loops, we do NOT check DB-onboarding here — the
  // individual pages handle that:
  //   /app/page.tsx          → redirects to /app/onboarding if user not in DB
  //   /app/onboarding/page.tsx → redirects to /app if user already in DB

  return (
    <div className="min-h-screen bg-[#030614] text-white">
      {children}
    </div>
  );
}
