/**
 * Default loading skeleton for /app/* routes.
 *
 * Next.js App Router uses this as the Suspense fallback while server
 * components fetch data. Keeps the dark layout consistent so users don't see
 * a flash of light/empty page.
 */

export default function AppLoading() {
  return (
    <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-6 animate-pulse">
      <header className="space-y-2">
        <div className="h-3 w-20 rounded bg-white/10" />
        <div className="h-7 w-64 rounded bg-white/10" />
        <div className="h-3 w-40 rounded bg-white/5" />
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-4 space-y-2">
            <div className="h-2 w-16 rounded bg-white/10" />
            <div className="h-6 w-12 rounded bg-white/10" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 w-20 rounded bg-white/10" />
            <div className="h-2 flex-1 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </main>
  );
}
