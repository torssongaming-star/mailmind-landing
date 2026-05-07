/**
 * /app 404 page — shown when notFound() is called from a route under /app.
 * Most common trigger: visiting /app/thread/<id> for a thread that was deleted
 * or belongs to another org.
 */

import Link from "next/link";

export default function AppNotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#030614]">
      <div className="w-full max-w-md text-center space-y-5">
        <p className="text-6xl font-bold text-white/10 leading-none">404</p>
        <div>
          <h1 className="text-xl font-bold text-white mb-2">Not found</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This thread or page doesn&apos;t exist, or it belongs to a different
            workspace.
          </p>
        </div>
        <div className="flex justify-center gap-2 pt-2">
          <Link
            href="/app/inbox"
            className="px-5 py-2 rounded-xl bg-primary text-[#030614] text-sm font-semibold hover:bg-cyan-300 transition-colors"
          >
            Back to inbox
          </Link>
          <Link
            href="/app"
            className="px-5 py-2 rounded-xl border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors"
          >
            App home
          </Link>
        </div>
      </div>
    </main>
  );
}
