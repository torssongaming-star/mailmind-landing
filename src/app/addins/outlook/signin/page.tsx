/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { SignIn } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import Script from "next/script";

/**
 * Sign-in page for the Office Dialog.
 * This page is opened in a popup window by the main taskpane.
 */
export default function OutlookSigninPage() {
  const [officeReady, setOfficeReady] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Office) {
      (window as any).Office.onReady(() => {
        setOfficeReady(true);
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#050B1C] flex flex-col items-center justify-center p-6">
      <Script 
        src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js" 
        strategy="beforeInteractive" 
      />
      
      {!officeReady ? (
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      ) : (
        <div className="w-full max-w-md">
          <SignIn 
            routing="hash" 
            fallbackRedirectUrl="/addins/outlook/signin-callback"
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "bg-[#0A1129] border border-white/10 shadow-2xl",
                headerTitle: "text-white",
                headerSubtitle: "text-muted-foreground",
                socialButtonsBlockButton: "bg-white/5 border-white/10 hover:bg-white/10 text-white",
                formFieldLabel: "text-muted-foreground",
                formFieldInput: "bg-white/5 border-white/10 text-white",
                footerActionText: "text-muted-foreground",
                footerActionLink: "text-primary hover:text-cyan-300",
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
