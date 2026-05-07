/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect } from "react";
import Script from "next/script";
import { Loader2 } from "lucide-react";

/**
 * Callback page for the Office Dialog auth flow.
 * Notifies the parent taskpane that sign-in was successful.
 */
export default function OutlookSigninCallbackPage() {
  useEffect(() => {
    // We need to wait for Office.js to be ready before messaging the parent
    if (typeof window !== "undefined" && (window as any).Office) {
      (window as any).Office.onReady(() => {
        try {
          (window as any).Office.context.ui.messageParent(
            JSON.stringify({ status: "success" })
          );
        } catch (err) {
          console.error("Error messaging parent:", err);
        }
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#050B1C] flex flex-col items-center justify-center p-6 space-y-4">
      <Script 
        src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js" 
        strategy="beforeInteractive" 
      />
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <p className="text-sm text-white font-medium">Finalizing sign-in...</p>
    </div>
  );
}
