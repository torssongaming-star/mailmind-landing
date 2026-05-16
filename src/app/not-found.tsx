/**
 * Root 404 — catches any path that doesn't match a route.
 * Brand-aligned dark theme, bilingual headline.
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#030614] text-white">
      <div className="w-full max-w-md text-center space-y-6">
        <p className="text-7xl font-bold text-white/10 leading-none">404</p>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Sidan finns inte</h1>
          <p className="text-sm text-white/55 leading-relaxed">
            Länken är trasig eller så har sidan flyttats. Inget farligt har hänt.
          </p>
        </div>
        <div className="flex justify-center gap-2 pt-2">
          <Link
            href="/"
            className="px-5 py-2 rounded-xl bg-primary text-[#030614] text-sm font-semibold hover:bg-cyan-300 transition-colors"
          >
            Till startsidan
          </Link>
          <Link
            href="/app"
            className="px-5 py-2 rounded-xl border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors"
          >
            Mailmind-appen
          </Link>
        </div>
      </div>
    </main>
  );
}
