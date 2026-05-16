"use client";

/**
 * Global error boundary — catches errors from anywhere in the app that aren't
 * caught by a more specific error.tsx. Replaces the root layout in this case
 * so it must be self-contained (own <html> + <body>).
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="sv">
      <body style={{ margin: 0, background: "#030614", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ maxWidth: "420px", textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: "0 auto 20px",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
              color: "#f87171", fontSize: 24, fontWeight: 700,
            }}>!</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Något gick fel</h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.5, margin: 0 }}>
              Ett oväntat fel uppstod. Vi har blivit meddelade. Försök igen — de flesta fel är tillfälliga.
            </p>
            {error.digest && (
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", margin: "12px 0 0" }}>
                Ref: {error.digest}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, paddingTop: 16 }}>
              <button
                onClick={reset}
                style={{
                  padding: "8px 20px", borderRadius: 12, background: "#06b6d4",
                  color: "#030614", fontWeight: 600, fontSize: 14, cursor: "pointer", border: "none",
                }}
              >
                Försök igen
              </button>
              <a href="/" style={{
                padding: "8px 20px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none",
              }}>
                Hem
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
