"use client";

/**
 * ConfirmDialog — branded alternative to native `confirm()`.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   ...
 *   <ConfirmDialog
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     onConfirm={async () => { await deleteThing(); setOpen(false); }}
 *     title="Ta bort?"
 *     body="Det här går inte att ångra."
 *     confirmLabel="Ta bort"
 *     tone="danger"
 *   />
 *
 * Features:
 *   - ESC closes
 *   - Click on backdrop closes (mousedown-target check to avoid drag-close)
 *   - Locks body scroll while open
 *   - aria-modal + focuses confirm button on open
 *   - Loading state on confirm button while async onConfirm resolves
 */

import { useEffect, useRef } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";

type Tone = "danger" | "warning" | "primary";

const TONE: Record<Tone, { iconBg: string; iconColor: string; icon: React.ElementType; btnBg: string; btnText: string; btnRing: string }> = {
  danger:  { iconBg: "bg-red-500/10 border border-red-500/25",   iconColor: "text-red-400",   icon: AlertTriangle, btnBg: "bg-red-500 hover:bg-red-400",  btnText: "text-white",                          btnRing: "focus-visible:ring-red-500/60" },
  warning: { iconBg: "bg-amber-500/10 border border-amber-500/25", iconColor: "text-amber-400", icon: AlertTriangle, btnBg: "bg-amber-500 hover:bg-amber-400", btnText: "text-[hsl(var(--surface-base))]",   btnRing: "focus-visible:ring-amber-500/60" },
  primary: { iconBg: "bg-primary/10 border border-primary/25",   iconColor: "text-primary",   icon: ShieldCheck,   btnBg: "bg-primary hover:bg-cyan-300",   btnText: "text-[hsl(var(--surface-base))]",   btnRing: "focus-visible:ring-primary/60" },
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Bekräfta",
  cancelLabel  = "Avbryt",
  tone         = "danger",
  pending      = false,
}: {
  open:          boolean;
  onClose:       () => void;
  onConfirm:     () => void | Promise<void>;
  title:         string;
  body?:         string;
  confirmLabel?: string;
  cancelLabel?:  string;
  tone?:         Tone;
  pending?:      boolean;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);

    // Focus the confirm button when opening — most predictable target
    const t = setTimeout(() => confirmRef.current?.focus(), 50);

    // Body scroll lock
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, pending]);

  if (!open) return null;

  const s = TONE[tone];
  const Icon = s.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onMouseDown={e => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[hsl(var(--surface-elev-1))] p-5 shadow-2xl"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className={`shrink-0 w-9 h-9 rounded-xl ${s.iconBg} flex items-center justify-center`}>
            <Icon size={16} className={s.iconColor} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h2 id="confirm-dialog-title" className="text-sm font-semibold text-white">{title}</h2>
            {body && <p className="text-xs text-white/55 mt-1.5 leading-relaxed">{body}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/5">
          <button
            onClick={onClose}
            disabled={pending}
            className="inline-flex items-center h-8 px-3 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-white/[0.04] transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={() => { void onConfirm(); }}
            disabled={pending}
            className={`inline-flex items-center h-8 px-3.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--surface-elev-1))] ${s.btnBg} ${s.btnText} ${s.btnRing}`}
          >
            {pending ? "Bearbetar…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
