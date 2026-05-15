"use client";

/**
 * PushNotifications — toggle + status indicator.
 *
 * Renders three states based on the browser's permission + subscription state:
 *   - Unsupported: hide entirely (no service worker / Push API)
 *   - Denied:     show "blocked in browser" message with help text
 *   - Default:    show "enable" button
 *   - Subscribed: show "active" + disable button
 *
 * Handles the full flow:
 *   1. Register service worker (/sw.js)
 *   2. Request Notification.permission
 *   3. PushManager.subscribe with VAPID public key
 *   4. POST subscription to /api/app/push/subscribe
 *   5. (or DELETE on unsubscribe)
 */

import { useEffect, useState, useCallback } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";

type Status = "unknown" | "unsupported" | "denied" | "default" | "subscribed";

/** Convert URL-safe base64 (used by VAPID) → Uint8Array (required by browser API) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(base64);
  const out     = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushNotifications({
  vapidPublicKey,
  variant = "row",
}: {
  vapidPublicKey: string | null;
  variant?: "row" | "card";
}) {
  const [status, setStatus] = useState<Status>("unknown");
  const [pending, setPending] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // ── Init: detect support + current subscription ───────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (!vapidPublicKey) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      try {
        // Register or get existing SW
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;

        if (Notification.permission === "denied") {
          setStatus("denied");
        } else if (sub) {
          setStatus("subscribed");
        } else {
          setStatus("default");
        }
      } catch (e) {
        console.error("[push] init failed:", e);
        if (!cancelled) setStatus("unsupported");
      }
    })();

    return () => { cancelled = true; };
  }, [vapidPublicKey]);

  // ── Enable ────────────────────────────────────────────────────────────────
  const enable = useCallback(async () => {
    if (!vapidPublicKey) return;
    setError(null); setPending(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "default");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:     true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      const json = sub.toJSON();
      const res = await fetch("/api/app/push/subscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          endpoint:  json.endpoint,
          keys:      json.keys,
          userAgent: navigator.userAgent.slice(0, 255),
        }),
      });
      if (!res.ok) throw new Error("Kunde inte registrera prenumeration på servern");

      setStatus("subscribed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(false);
    }
  }, [vapidPublicKey]);

  // ── Disable ───────────────────────────────────────────────────────────────
  const disable = useCallback(async () => {
    setError(null); setPending(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/app/push/subscribe", {
          method:  "DELETE",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ endpoint }),
        }).catch(() => {});
      }
      setStatus("default");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(false);
    }
  }, []);

  if (status === "unknown" || status === "unsupported") return null;

  // ── Render ────────────────────────────────────────────────────────────────
  const isCard = variant === "card";

  return (
    <div className={isCard
      ? "rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5 space-y-3"
      : "flex items-center justify-between gap-4 py-2"
    }>
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {status === "subscribed" ? <BellRing size={16} className="text-primary" />
           : status === "denied"   ? <BellOff  size={16} className="text-red-400" />
           :                         <Bell     size={16} className="text-white/50" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">
            {status === "subscribed" ? "Push-notiser aktiverade"
             : status === "denied"   ? "Notiser blockerade i webbläsaren"
             :                         "Få push-notis när ett nytt ärende kommer in"}
          </p>
          <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">
            {status === "subscribed" ? "Du får en notis när ett nytt mejl väntar på din inkorg."
             : status === "denied"   ? "Öppna webbläsarens platsinställningar och tillåt notiser för att aktivera."
             :                         "Funkar på iPhone (Safari), Android (Chrome) och alla desktop-webbläsare."}
          </p>
          {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
        </div>
      </div>

      <div className="shrink-0">
        {status === "default" && (
          <button
            onClick={enable}
            disabled={pending}
            className="px-3.5 py-1.5 rounded-lg bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {pending ? "Aktiverar…" : "Aktivera"}
          </button>
        )}
        {status === "subscribed" && (
          <button
            onClick={disable}
            disabled={pending}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium transition-colors whitespace-nowrap"
          >
            {pending ? "Avregistrerar…" : "Avaktivera"}
          </button>
        )}
      </div>
    </div>
  );
}
