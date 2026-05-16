/**
 * Loading skeleton for /app/inbox — split-pane (thread list + content panel).
 * Mimics the real InboxShell layout so the transition feels instant.
 */

import { ThreadListSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function InboxLoading() {
  return (
    <div className="flex h-[100dvh]">
      {/* Left: thread list */}
      <div className="w-[360px] border-r border-white/5 bg-[#050B1C]/40 flex flex-col">
        {/* Filter bar */}
        <div className="h-14 border-b border-white/5 flex items-center px-4 gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-20" />
        </div>
        {/* Search */}
        <div className="px-4 py-3 border-b border-white/5">
          <Skeleton className="h-8 w-full" />
        </div>
        {/* Thread list */}
        <div className="flex-1 overflow-hidden">
          <ThreadListSkeleton rows={12} />
        </div>
      </div>

      {/* Right: content panel */}
      <div className="flex-1 flex flex-col">
        <div className="h-14 border-b border-white/5 flex items-center px-6 gap-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-2.5 w-32" />
          </div>
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-20 w-3/4" />
        </div>
      </div>
    </div>
  );
}
