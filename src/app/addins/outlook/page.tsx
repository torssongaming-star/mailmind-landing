/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { useAuth, useUser } from "@clerk/nextjs";
import { 
  AppWindow, 
  ExternalLink, 
  Zap, 
  AlertCircle,
  Mail,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Define the shape of /api/app/me based on typical portal data
interface UserData {
  organization: { name: string };
  subscription: { plan: string; status: string } | null;
  entitlements: { maxAiDraftsPerMonth: number; maxInboxes: number } | null;
  usage: { aiDraftsUsed: number } | null;
  access: { canUseApp: boolean; reason: string };
}

export default function OutlookTaskpane() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize Office.js
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Office) {
      (window as any).Office.onReady(() => {
        console.log("Office.js is ready");
      });
    }
  }, []);

  // Fetch Mailmind user data when signed in
  useEffect(() => {
    if (isSignedIn) {
      setLoading(true);
      fetch("/api/app/me")
        .then((res) => res.json())
        .then((data) => setUserData(data))
        .catch((err) => console.error("Error fetching user data:", err))
        .finally(() => setLoading(false));
    }
  }, [isSignedIn]);

  // Handle Login via Office Dialog API
  const handleLogin = () => {
    if (!(window as any).Office?.context?.ui) return;

    const host = window.location.origin;
    const signInUrl = `${host}/addins/outlook/signin`;

    (window as any).Office.context.ui.displayDialogAsync(
      signInUrl,
      { height: 60, width: 30, displayInIframe: false },
      (asyncResult: any) => {
        if (asyncResult.status === (window as any).Office.AsyncResultStatus.Failed) {
          console.error("Dialog failed:", asyncResult.error.message);
        } else {
          const dialog = asyncResult.value;
          dialog.addEventHandler((window as any).Office.EventType.DialogMessageReceived, (arg: any) => {
            const message = JSON.parse(arg.message);
            if (message.status === "success") {
              dialog.close();
              // Reload to pick up Clerk session
              window.location.reload();
            }
          });
        }
      }
    );
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#030614] text-white p-6 space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Connecting to Mailmind...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#030614] text-white font-sans overflow-x-hidden">
      <Script 
        src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js" 
        strategy="beforeInteractive" 
      />

      {/* Header */}
      <header className="h-14 flex items-center px-5 border-b border-white/5 bg-[#050B1C]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
            <Mail size={14} />
          </div>
          <span className="font-bold text-base tracking-tight">Mailmind</span>
        </div>
      </header>

      <main className="flex-1 p-5 space-y-6">
        {!isSignedIn ? (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-muted-foreground border border-white/10">
              <AppWindow size={32} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Sign In</h2>
              <p className="text-xs text-muted-foreground mt-2 max-w-[200px] mx-auto">
                Connect your Mailmind account to start using AI triage in Outlook.
              </p>
            </div>
            <Button 
              onClick={handleLogin}
              className="w-full bg-primary text-[#030614] font-bold shadow-[0_0_15px_rgba(6,182,212,0.25)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all"
            >
              Log in to Mailmind
            </Button>
          </div>
        ) : (
          <>
            {/* Welcome */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1">Authenticated</p>
              <h2 className="text-lg font-bold text-white truncate">
                {userData?.organization.name || user?.fullName || "Your Account"}
              </h2>
            </div>

            {/* Status Section */}
            <div className="space-y-3">
              {userData?.access.canUseApp === false ? (
                <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 text-red-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} className="text-red-400" />
                    <p className="font-semibold text-xs text-white">Access Blocked</p>
                  </div>
                  <p className="text-[10px] leading-relaxed">
                    Your subscription requires attention. Update your billing info to restore access.
                  </p>
                  <Button asChild size="sm" variant="outline" className="w-full h-8 text-[10px] bg-white/5 border-white/10 hover:bg-white/10 text-white">
                    <a href="/dashboard/billing" target="_blank" rel="noopener noreferrer">
                      Manage Billing <ExternalLink size={10} className="ml-1.5 opacity-60" />
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-white/8 bg-[#050B1C]/60 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-primary" />
                      <span className="text-xs font-semibold text-white">AI Drafts</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {userData?.usage?.aiDraftsUsed || 0} / {userData?.entitlements?.maxAiDraftsPerMonth || 0}
                    </span>
                  </div>
                  
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-cyan-300 rounded-full transition-all"
                      style={{ 
                        width: `${Math.min(100, ((userData?.usage?.aiDraftsUsed || 0) / (userData?.entitlements?.maxAiDraftsPerMonth || 1)) * 100)}%` 
                      }}
                    />
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Current Plan</span>
                      <span className="text-white font-medium capitalize">{userData?.subscription?.plan || "Free"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 pt-4">
              <Button asChild className="w-full justify-between group h-11 bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all">
                <a href="/app/inbox" target="_blank" rel="noopener noreferrer">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary">
                      <Mail size={12} />
                    </div>
                    <span className="text-sm">Open Inbox</span>
                  </div>
                  <ExternalLink size={14} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                </a>
              </Button>
              
              <Button asChild variant="ghost" className="w-full text-xs text-muted-foreground hover:text-white hover:bg-white/5">
                <a href="/dashboard/settings" target="_blank" rel="noopener noreferrer">
                  Account Settings
                </a>
              </Button>
            </div>
          </>
        )}
      </main>

      {/* Footer / Info */}
      <footer className="p-5 border-t border-white/5">
        <p className="text-[10px] text-muted-foreground text-center italic">
          Mailmind for Outlook v1.0.0
        </p>
      </footer>
    </div>
  );
}
