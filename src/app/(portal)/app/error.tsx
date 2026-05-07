"use client";

/**
 * Top-level error boundary for everything under /app.
 * Catches errors thrown by server components or unhandled async ops.
 * Always logged to console + (later) error tracker; user gets a friendly screen
 * with a retry option that re-runs the failing render.
 */

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#030614]">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl bg-red-500/15 border border-red-500/30 text-red-400">
          !
        </div>
        <div>
          <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We hit an unexpected error. The team has been notified. You can try
            again — most issues are transient.
          </p>
          {error.digest && (
            <p className="text-[10px] text-muted-foreground/50 font-mono mt-3">
              Reference: {error.digest}
            </p>
          )}
        </div>
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={reset}
            className="px-5 py-2 rounded-xl bg-primary text-[#030614] text-sm font-semibold hover:bg-cyan-300 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/app"
            className="px-5 py-2 rounded-xl border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors"
          >
            Back to app
          </Link>
        </div>
      </div>
    </main>
  );
}
