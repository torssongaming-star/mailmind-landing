"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, AlertTriangle } from "lucide-react";

/**
 * ManageBillingButton
 *
 * Calls POST /api/billing/portal, receives a Stripe Customer Portal URL,
 * and redirects the browser there. Shows loading and error states inline.
 */
export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.url;
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-[#030614] text-sm font-semibold hover:bg-cyan-300 active:bg-cyan-600 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Opening portal…
          </>
        ) : (
          <>
            Manage billing on Stripe
            <ExternalLink size={14} />
          </>
        )}
      </button>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 mt-2">
          <AlertTriangle size={13} className="shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
