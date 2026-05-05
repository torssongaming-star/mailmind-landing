"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CheckoutButton({
  plan,
  label,
  isCurrent,
}: {
  plan: string;
  label: string;
  isCurrent: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    if (isCurrent) return;
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        router.push(data.url);
      } else {
        console.error("Checkout error:", data.error);
        alert(data.error ?? "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isCurrent || loading}
      className={`mt-3 w-full py-2 rounded-lg text-xs font-semibold transition-all ${
        isCurrent
          ? "bg-primary/10 text-primary border border-primary/20 cursor-default"
          : "bg-white/5 border border-white/10 text-white hover:bg-white/10 active:scale-[0.98]"
      } disabled:opacity-60`}
    >
      {loading ? "Redirecting…" : isCurrent ? "Current plan" : label}
    </button>
  );
}
