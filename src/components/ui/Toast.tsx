"use client";

/**
 * Lightweight toast system — no external deps.
 *
 * Usage:
 *   const { toasts, toast } = useToast();
 *   toast.success("Klart!");
 *   toast.error("Något gick fel");
 *   toast.warning("OBS: …", { duration: 8000 });
 *
 * Render <ToastContainer toasts={toasts} /> once per page.
 */

import { useState, useCallback, useEffect } from "react";
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export type Toast = {
  id:       string;
  type:     ToastType;
  message:  string;
  detail?:  string;
  duration: number;
};

type ToastOptions = { detail?: string; duration?: number };

let idCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const add = useCallback((type: ToastType, message: string, opts: ToastOptions = {}) => {
    const id = `toast-${++idCounter}`;
    const duration = opts.duration ?? (type === "error" || type === "warning" ? 7000 : 4000);
    setToasts(prev => [...prev, { id, type, message, detail: opts.detail, duration }]);
    setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const toast = {
    success: (msg: string, opts?: ToastOptions) => add("success", msg, opts),
    error:   (msg: string, opts?: ToastOptions) => add("error",   msg, opts),
    warning: (msg: string, opts?: ToastOptions) => add("warning", msg, opts),
    info:    (msg: string, opts?: ToastOptions) => add("info",    msg, opts),
  };

  return { toasts, toast, dismiss };
}

// ── Container ─────────────────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
};

const STYLES: Record<ToastType, { border: string; icon: string; bg: string; glow: string }> = {
  success: { bg: "bg-[hsl(var(--surface-elev-1))]", border: "border-green-500/30",  icon: "text-green-400",  glow: "shadow-[0_8px_24px_-8px_rgba(34,197,94,0.35)]" },
  error:   { bg: "bg-[hsl(var(--surface-elev-1))]", border: "border-red-500/30",    icon: "text-red-400",    glow: "shadow-[0_8px_24px_-8px_rgba(239,68,68,0.4)]" },
  warning: { bg: "bg-[hsl(var(--surface-elev-1))]", border: "border-amber-500/30",  icon: "text-amber-400",  glow: "shadow-[0_8px_24px_-8px_rgba(251,191,36,0.35)]" },
  info:    { bg: "bg-[hsl(var(--surface-elev-1))]", border: "border-primary/30",    icon: "text-primary",    glow: "shadow-[0_8px_24px_-8px_rgba(6,182,212,0.35)]" },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const s = STYLES[toast.type];
  const Icon = ICONS[toast.type];

  useEffect(() => {
    // Animate in
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 200);
  };

  return (
    <div
      role={toast.type === "error" || toast.type === "warning" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      className={[
        "flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md min-w-[280px] max-w-sm w-full",
        s.bg, s.border, s.glow,
        "transition-all duration-200 ease-out",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
      ].join(" ")}
    >
      <Icon size={15} className={`${s.icon} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white leading-snug">{toast.message}</p>
        {toast.detail && (
          <p className="text-[11px] text-white/50 mt-0.5 leading-snug">{toast.detail}</p>
        )}
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Stäng notis"
        className="text-white/25 hover:text-white/60 transition-colors shrink-0 mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={() => onDismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
