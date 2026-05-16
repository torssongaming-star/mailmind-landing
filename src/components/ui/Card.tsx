/**
 * Card — the standard surface used everywhere in the app.
 *
 * Replaces ad-hoc `rounded-2xl border border-white/8 bg-[#050B1C]/60` clusters.
 * Variants:
 *   - default  : neutral card on app background
 *   - elevated : slightly brighter for hover/focus states
 *   - deep     : darker than base (sidebar, popovers)
 *
 * Use `as` prop to render as section/article/etc when semantically appropriate.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "elevated" | "deep" | "accent";
type CardPadding = "none" | "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default:  "border border-white/8 bg-[hsl(var(--surface-elev-1))]/70 backdrop-blur-sm",
  elevated: "border border-white/10 bg-[hsl(var(--surface-elev-2))]/80 backdrop-blur-sm",
  deep:     "border border-white/8 bg-[hsl(var(--surface-deep))]/80 backdrop-blur-sm",
  accent:   "border border-primary/25 bg-primary/[0.04] backdrop-blur-sm",
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "",
  sm:   "p-3",
  md:   "p-5",
  lg:   "p-6 md:p-7",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:     CardVariant;
  padding?:     CardPadding;
  interactive?: boolean;
  as?:          "div" | "section" | "article" | "aside";
}

export function Card({
  variant     = "default",
  padding     = "md",
  interactive = false,
  as: Element = "div",
  className,
  ...props
}: CardProps) {
  return (
    <Element
      className={cn(
        "rounded-2xl",
        VARIANT_CLASSES[variant],
        PADDING_CLASSES[padding],
        interactive && "transition-colors duration-200 hover:border-white/12 hover:bg-[hsl(var(--surface-elev-2))]/90 cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}

/** Card header — left-aligned title + optional right-aligned action slot */
export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title:        React.ReactNode;
  description?: React.ReactNode;
  action?:      React.ReactNode;
  className?:   string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-4", className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description && (
          <p className="text-xs text-white/45 mt-1 leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
