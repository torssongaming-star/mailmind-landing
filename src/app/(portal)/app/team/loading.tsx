import { Skeleton } from "@/components/ui/Skeleton";

export default function TeamLoading() {
  return (
    <main className="max-w-3xl mx-auto p-6 md:p-10 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-72" />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-24" />
        </div>
      </div>

      {/* Members section */}
      <div className="space-y-3">
        <Skeleton className="h-2.5 w-32" />
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 overflow-hidden divide-y divide-white/5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-2.5 w-28" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
