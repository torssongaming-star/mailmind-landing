/**
 * AppButton — single source of truth for clickable actions inside /app.
 *
 * Separate from the landing-page Button (which has different styling needs
 * around marketing pages). Use this everywhere under /app/*.
 *
 * Variants:
 *   primary   — bright cyan CTA. Use for THE main action per surface.
 *   secondary — neutral white-on-translucent. Default for most buttons.
 *   ghost     — minimal, no background. For toolbar/inline actions.
 *   danger    — destructive ops (delete, disconnect).
 *   outline   — for links that look like buttons.
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size    = "xs" | "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-primary text-[hsl(var(--surface-base))] hover:bg-cyan-300 " +
    "shadow-[0_4px_18px_-2px_hsl(189_94%_43%/0.35)] " +
    "hover:shadow-[0_6px_22px_-2px_hsl(189_94%_43%/0.5)]",
  secondary:
    "bg-white/[0.04] text-white border border-white/10 hover:bg-white/[0.08] hover:border-white/15",
  ghost:
    "text-white/70 hover:text-white hover:bg-white/[0.04]",
  danger:
    "bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 hover:text-red-200",
  outline:
    "border border-white/10 text-white hover:bg-white/[0.04] hover:border-white/20",
};

const SIZE_CLASSES: Record<Size, string> = {
  xs: "h-7  px-2.5 text-[11px] gap-1.5 rounded-lg",
  sm: "h-8  px-3   text-xs    gap-1.5 rounded-lg",
  md: "h-9  px-4   text-sm    gap-2   rounded-xl",
  lg: "h-11 px-6   text-sm    gap-2   rounded-xl",
};

export interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant;
  size?:     Size;
  loading?:  boolean;
  asChild?:  boolean;
  iconLeft?: React.ReactNode;
}

export const AppButton = React.forwardRef<HTMLButtonElement, AppButtonProps>(function AppButton(
  {
    variant   = "secondary",
    size      = "sm",
    loading   = false,
    asChild   = false,
    iconLeft,
    className,
    children,
    disabled,
    ...props
  },
  ref,
) {
  const Element = asChild ? Slot : "button";
  return (
    <Element
      ref={ref as never}
      className={cn(
        "inline-flex items-center justify-center font-semibold whitespace-nowrap",
        "transition-all duration-200 ease-out",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--surface-base))]",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={size === "xs" ? 12 : size === "sm" ? 13 : 14} />
      ) : iconLeft ? (
        <span className="shrink-0">{iconLeft}</span>
      ) : null}
      {children}
    </Element>
  );
});
