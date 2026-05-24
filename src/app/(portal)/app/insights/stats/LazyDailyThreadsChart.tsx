"use client";

/**
 * Client-side dynamic wrapper around DailyThreadsChart.
 *
 * Why this exists:
 *   recharts is ~351 KB minified. Importing DailyThreadsChart directly
 *   from a Server Component pulls recharts into shared chunks that the
 *   Next.js bundler may promote into the common runtime, leaking it onto
 *   pages that don't render the chart (e.g. the marketing homepage `/`).
 *
 *   Using next/dynamic here forces recharts into its own async chunk that
 *   is only fetched when this wrapper actually mounts on the stats page.
 *
 *   This wrapper has to live in a separate "use client" file because
 *   `next/dynamic({ ssr: false })` is not allowed inside async Server
 *   Components, and the stats page is a server component.
 */

import dynamic from "next/dynamic";

type Point = { date: string; count: number };

const DailyThreadsChart = dynamic(
  () => import("./DailyThreadsChart").then(m => m.DailyThreadsChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-48 w-full animate-pulse rounded-lg bg-white/[0.02]"
        aria-label="Laddar graf"
      />
    ),
  }
);

export function LazyDailyThreadsChart({ data }: { data: Point[] }) {
  return <DailyThreadsChart data={data} />;
}
