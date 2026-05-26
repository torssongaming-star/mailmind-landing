/**
 * PageHeader — konsekvent sidrubrik för portal-vyer.
 *
 * Standardiserar mönstret som tidigare upprepades inline:
 *   <header>
 *     <p eyebrow>App</p>
 *     <h1>Title</h1>
 *     <p subtitle>...</p>
 *     <Link>← Tillbaka</Link>
 *   </header>
 *
 * Anrop:
 *   <PageHeader
 *     eyebrow="App"
 *     title="Inkorgar"
 *     subtitle={<>3 av 5 inkorgar</>}
 *     action={<Link href="/app">← Översikt</Link>}
 *   />
 *
 * Server-component-säker (ingen "use client", inga hooks).
 *
 * Används inte i inboxen (sidan har en specialiserad full-height-header)
 * eller insights (egen tab-strip-konstruktion).
 */

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?:  string;
  title:     string;
  subtitle?: React.ReactNode;
  action?:   React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl md:text-2xl font-bold text-white truncate tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-white/65 mt-1 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </header>
  );
}
