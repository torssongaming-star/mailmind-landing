"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

/**
 * Polls /api/app/threads?inboxId=X for up to 60s after an inbox is created.
 * When the first thread arrives, switches to a "verified" state with a link
 * straight into the inbox. The user can dismiss it at any time.
 *
 * Why poll instead of SSE/websocket: webhooks land at unpredictable times
 * (DNS propagation, sender's MTA), and polling every 2s for one minute is
 * cheap. The endpoint is filterable (?inboxId=...&limit=1) so each request
 * is one indexed row.
 */
export function ConnectionTester({
  inboxId,
  email,
  onDismiss,
}: {
  inboxId: string;
  email:   string;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<"polling" | "verified" | "timeout">("polling");
  const [firstThreadId, setFirstThreadId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    if (state !== "polling") return;
    let cancelled = false;
    const startedAt = Date.now();

    const tick = async () => {
      if (cancelled) return;
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setSecondsLeft(Math.max(0, 60 - elapsed));

      try {
        const res = await fetch(`/api/app/threads?inboxId=${encodeURIComponent(inboxId)}&limit=1`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          const tArr = (data.threads ?? [])[0];
          if (tArr && !cancelled) {
            setFirstThreadId(tArr.id);
            setState("verified");
            return;
          }
        }
      } catch {
        // Network blip — keep polling.
      }

      if (elapsed >= 60) {
        if (!cancelled) setState("timeout");
        return;
      }
      setTimeout(tick, 2000);
    };

    // First tick immediately, then every 2s
    tick();
    return () => { cancelled = true; };
  }, [inboxId, state]);

  if (state === "polling") {
    return (
      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
          </span>
          <p className="text-xs text-cyan-100 truncate">
            {t("portal.inboxes.tester.waiting", { email })} <span className="text-cyan-300/60 tabular-nums">{secondsLeft}s</span>
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-[10px] text-cyan-300/70 hover:text-cyan-200 transition-colors shrink-0"
        >
          {t("portal.inboxes.tester.skip")}
        </button>
      </div>
    );
  }

  if (state === "verified") {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/8 px-3 py-2.5 flex items-center justify-between gap-3">
        <p className="text-xs text-green-200">
          <span className="font-semibold">{t("portal.inboxes.tester.verified")}</span> {t("portal.inboxes.tester.firstThreadArrived")}
        </p>
        {firstThreadId ? (
          <Link
            href={`/app/thread/${firstThreadId}`}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-green-500/20 text-green-200 hover:bg-green-500/30 transition-colors shrink-0"
          >
            {t("portal.inboxes.tester.openThread")}
          </Link>
        ) : (
          <button
            onClick={onDismiss}
            className="text-[10px] text-green-300/70 hover:text-green-200 transition-colors shrink-0"
          >
            {t("portal.inboxes.tester.close")}
          </button>
        )}
      </div>
    );
  }

  // timeout
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 flex items-center justify-between gap-3">
      <p className="text-xs text-amber-100/90">
        {t("portal.inboxes.tester.timeout")}
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => { setState("polling"); setSecondsLeft(60); }}
          className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 transition-colors"
        >
          {t("portal.inboxes.tester.retry")}
        </button>
        <button
          onClick={onDismiss}
          className="text-[10px] text-amber-300/70 hover:text-amber-200 transition-colors"
        >
          {t("portal.inboxes.tester.close")}
        </button>
      </div>
    </div>
  );
}
