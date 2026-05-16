/**
 * Skeleton placeholder — animated shimmer for loading states.
 * Pure presentational, no client-side state needed.
 */

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-white/[0.04] border border-white/[0.03]",
        className,
      )}
    />
  );
}

/** Inbox thread row placeholder — matches real row dimensions */
export function ThreadRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
      <Skeleton className="w-2 h-2 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-2.5 w-2/3" />
      </div>
      <Skeleton className="h-2 w-8 shrink-0" />
    </div>
  );
}

/** Inbox thread list — N rows */
export function ThreadListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => <ThreadRowSkeleton key={i} />)}
    </div>
  );
}

/** Generic card skeleton — for dashboards / stats tiles */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-white/8 bg-[#050B1C]/40 p-5 space-y-3", className)}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-2.5 w-full" />
    </div>
  );
}
