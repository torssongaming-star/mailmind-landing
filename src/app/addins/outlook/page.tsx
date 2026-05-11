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
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp
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

interface TriageResult {
  threadId: string;
  subject: string;
  classification: "ask" | "summarize" | "escalate";
  draftId: string | null;
  draftPreview: string | null;
  confidence: number | null;
}

export default function OutlookTaskpane() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);

  // Triage state
  const [triaging, setTriaging] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [draftExpanded, setDraftExpanded] = useState(false);

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
    if (!(window as any).Office?.context?.ui) {
      window.location.href = "/login";
      return;
    }

    const host = window.location.origin;
    const signInUrl = `${host}/addins/outlook/signin`;

    (window as any).Office.context.ui.displayDialogAsync(
      signInUrl,
      { height: 60, width: 30, displayInIframe: false },
      (asyncResult: any) => {
        if (asyncResult.status === (window as any).Office.AsyncResultStatus.Failed) {
          console.error("Dialog failed:", asyncResult.error.message);
          window.location.href = "/login";
        } else {
          const dialog = asyncResult.value;
          dialog.addEventHandler((window as any).Office.EventType.DialogMessageReceived, (arg: any) => {
            try {
              const message = JSON.parse(arg.message);
              if (message && message.status === "success") {
                dialog.close();
                window.location.reload();
              }
            } catch (e) {
              console.error("Invalid message from dialog:", e);
            }
          });

          dialog.addEventHandler((window as any).Office.EventType.DialogEventReceived, (arg: any) => {
            if (arg.error === 12006) {
              console.log("User closed the login dialog");
            }
          });
        }
      }
    );
  };

  // Read the current email from Office.js and POST it to the triage endpoint
  const handleTriage = async () => {
    setTriaging(true);
    setTriageResult(null);
    setTriageError(null);
    setDraftExpanded(false);

    try {
      const item = (window as any).Office?.context?.mailbox?.item;
      if (!item) {
        throw new Error("Inget mejl markerat i Outlook.");
      }

      // Get subject
      const subject: string = item.subject ?? "(inget ämne)";

      // Get sender
      const from: string = item.from?.emailAddress ?? "";

      // Get body (async)
      const body: string = await new Promise((resolve, reject) => {
        item.body.getAsync(
          (window as any).Office.CoercionType.Text,
          { asyncContext: "body" },
          (result: any) => {
            if (result.status === (window as any).Office.AsyncResultStatus.Succeeded) {
              resolve(result.value as string);
            } else {
              reject(new Error(result.error?.message ?? "Kunde inte läsa mejlkroppen."));
            }
          }
        );
      });

      // POST to the triage API
      const res = await fetch("/api/app/threads/triage-from-addin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, from, body }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? `API svarade med ${res.status}`);
      }

      const data: TriageResult = await res.json();
      setTriageResult(data);
    } catch (err: any) {
      setTriageError(err?.message ?? "Okänt fel vid triagering.");
    } finally {
      setTriaging(false);
    }
  };

  if (!isLoaded || (isSignedIn && !userData)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#030614] text-white p-6 space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Öppnar inkorg...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#030614] text-white p-6 space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Ansluter till Mailmind...</p>
      </div>
    );
  }

  const classificationLabel: Record<string, string> = {
    ask: "Fråga",
    summarize: "Sammanfattning",
    escalate: "Eskalering",
  };

  const classificationColor: Record<string, string> = {
    ask: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30",
    summarize: "text-blue-300 bg-blue-500/10 border-blue-500/30",
    escalate: "text-red-300 bg-red-500/10 border-red-500/30",
  };

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
              <h2 className="text-lg font-bold text-white">Logga in</h2>
              <p className="text-xs text-muted-foreground mt-2 max-w-[200px] mx-auto">
                Koppla ditt Mailmind-konto för att börja använda AI-triagering i Outlook.
              </p>
            </div>
            <Button
              onClick={handleLogin}
              className="w-full bg-primary text-[#030614] font-bold shadow-[0_0_15px_rgba(6,182,212,0.25)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all"
            >
              Logga in på Mailmind
            </Button>
          </div>
        ) : (
          <>
            {/* Welcome */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1">Inloggad</p>
              <h2 className="text-lg font-bold text-white truncate">
                {userData?.organization.name || user?.fullName || "Ditt konto"}
              </h2>
            </div>

            {/* Access blocked */}
            {userData?.access.canUseApp === false ? (
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 text-red-200 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="text-red-400" />
                  <p className="font-semibold text-xs text-white">Åtkomst blockerad</p>
                </div>
                <p className="text-[10px] leading-relaxed">
                  Din prenumeration kräver åtgärd. Uppdatera betalningsinformation för att återfå åtkomst.
                </p>
                <Button asChild size="sm" variant="outline" className="w-full h-8 text-[10px] bg-white/5 border-white/10 hover:bg-white/10 text-white">
                  <a href="/dashboard/billing" target="_blank" rel="noopener noreferrer">
                    Hantera fakturering <ExternalLink size={10} className="ml-1.5 opacity-60" />
                  </a>
                </Button>
              </div>
            ) : (
              <>
                {/* Triage button */}
                <div className="space-y-3">
                  <Button
                    onClick={handleTriage}
                    disabled={triaging}
                    className="w-full h-12 bg-primary text-[#030614] font-bold text-sm shadow-[0_0_15px_rgba(6,182,212,0.25)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all disabled:opacity-60"
                  >
                    {triaging ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        Triagerar...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} className="mr-2" />
                        Triage detta mejl
                      </>
                    )}
                  </Button>

                  {/* Triage error */}
                  {triageError && (
                    <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/5 flex items-start gap-2">
                      <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-red-200 leading-relaxed">{triageError}</p>
                    </div>
                  )}

                  {/* Triage result */}
                  {triageResult && (
                    <div className="rounded-xl border border-white/8 bg-[#050B1C]/60 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                        <p className="text-xs font-semibold text-white">Triagering klar</p>
                      </div>

                      <p className="text-[11px] text-muted-foreground truncate">{triageResult.subject}</p>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${classificationColor[triageResult.classification] ?? "text-white bg-white/10 border-white/20"}`}>
                          {classificationLabel[triageResult.classification] ?? triageResult.classification}
                        </span>
                        {triageResult.confidence != null && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {Math.round(triageResult.confidence * 100)}% confidence
                          </span>
                        )}
                      </div>

                      {triageResult.draftPreview && (
                        <div className="border-t border-white/5 pt-3 space-y-2">
                          <button
                            onClick={() => setDraftExpanded((v) => !v)}
                            className="flex items-center gap-1.5 text-[10px] text-primary font-semibold w-full text-left"
                          >
                            {draftExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {draftExpanded ? "Dölj förslag" : "Visa utkast"}
                          </button>
                          {draftExpanded && (
                            <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-10">
                              {triageResult.draftPreview}
                            </p>
                          )}
                        </div>
                      )}

                      <Button asChild size="sm" className="w-full h-8 text-[10px] bg-white/5 border border-white/10 hover:bg-white/10 text-white">
                        <a href={`/app/inbox?thread=${triageResult.threadId}&source=outlook`} target="_blank" rel="noopener noreferrer">
                          Öppna i Mailmind <ExternalLink size={10} className="ml-1.5 opacity-60" />
                        </a>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Usage stats */}
                <div className="rounded-xl border border-white/8 bg-[#050B1C]/60 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-primary" />
                      <span className="text-xs font-semibold text-white">AI-utkast</span>
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
                      <span className="text-muted-foreground">Nuvarande plan</span>
                      <span className="text-white font-medium capitalize">{userData?.subscription?.plan || "Free"}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-2">
                  <Button asChild className="w-full justify-between group h-11 bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all">
                    <a href="/app/inbox?source=outlook" target="_blank" rel="noopener noreferrer">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary">
                          <Mail size={12} />
                        </div>
                        <span className="text-sm">Öppna inkorg</span>
                      </div>
                      <ExternalLink size={14} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                    </a>
                  </Button>

                  <Button asChild variant="ghost" className="w-full text-xs text-muted-foreground hover:text-white hover:bg-white/5">
                    <a href="/dashboard/settings" target="_blank" rel="noopener noreferrer">
                      Kontoinställningar
                    </a>
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="p-5 border-t border-white/5">
        <p className="text-[10px] text-muted-foreground text-center italic">
          Mailmind för Outlook v1.0.0
        </p>
      </footer>
    </div>
  );
}
