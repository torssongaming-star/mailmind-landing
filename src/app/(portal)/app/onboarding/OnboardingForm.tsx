"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OnboardingForm({
  email,
  suggestedOrgName,
}: {
  email: string;
  suggestedOrgName: string;
}) {
  const router = useRouter();
  const [orgName, setOrgName] = useState(suggestedOrgName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/app/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: orgName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not create your account");
      }

      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Your email
        </label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full bg-white/5 text-muted-foreground text-sm rounded-lg px-4 py-2.5 border border-white/8 cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Workspace name
        </label>
        <input
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="e.g. Acme AB"
          required
          maxLength={120}
          className="w-full bg-white/5 text-white text-sm rounded-lg px-4 py-2.5 border border-white/10 focus:border-primary/50 focus:outline-none placeholder:text-muted-foreground/40"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Shown in the app and on invoices.
        </p>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !orgName.trim()}
        className="w-full px-4 py-2.5 rounded-xl bg-primary text-[#030614] text-sm font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? "Setting up your workspace…" : "Continue"}
      </button>
    </form>
  );
}
