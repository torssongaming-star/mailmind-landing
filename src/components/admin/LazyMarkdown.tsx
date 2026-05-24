"use client";

/**
 * Client-side dynamic wrapper around react-markdown.
 *
 * react-markdown plus its dependency tree (unified, micromark, remark)
 * is ~124 KB minified. Importing it from a Server Component pulls the
 * whole tree into shared chunks; this wrapper keeps it in its own async
 * chunk that is only fetched when a markdown surface actually renders.
 *
 * Used on admin pages where SEO doesn't matter (auth-gated).
 */

import dynamic from "next/dynamic";

const ReactMarkdown = dynamic(() => import("react-markdown"), {
  ssr: false,
  loading: () => (
    <p className="text-xs text-slate-500 italic">Laddar innehåll…</p>
  ),
});

export function LazyMarkdown({ children }: { children: string }) {
  return <ReactMarkdown>{children}</ReactMarkdown>;
}
