"use client";

/**
 * Command palette — Cmd/Ctrl+K opens a global launcher.
 *
 * Three sources of items:
 *   1. Static navigation (Inbox, Stats, Team, Settings, Billing, …)
 *   2. Static quick actions (Skapa testtråd, Bjud in, Logga ut, …)
 *   3. Dynamic thread search — fetched from /api/app/threads?q=... when
 *      the query length ≥ 2 (debounced 200ms)
 *
 * Keyboard:
 *   ⌘K / Ctrl+K       → open
 *   ESC               → close
 *   ↑ / ↓             → move highlight
 *   Enter             → activate highlighted
 *   ⌘? / Ctrl+?       → also opens (alternate)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import {
  LayoutDashboard, Mail, BarChart2, Users, Settings, CreditCard,
  Activity, Inbox as InboxIcon, UserPlus, LogOut, Search, ArrowRight,
  ChevronUp, ChevronDown, MessageSquare, Sparkles, Plus,
} from "lucide-react";

type StaticItem = {
  kind:    "nav" | "action";
  id:      string;
  label:   string;
  hint?:   string;
  icon:    React.ElementType;
  href?:   string;
  onRun?:  () => void;
  /** Keywords for fuzzy matching (lowercase) */
  keywords: string[];
};

type ThreadItem = {
  kind:    "thread";
  id:      string;
  label:   string;     // subject or "(inget ämne)"
  hint:    string;     // fromName <fromEmail>
  href:    string;
};

type Item = StaticItem | ThreadItem;

/** Simple fuzzy match: every char in query must appear in haystack in order */
function fuzzy(query: string, haystack: string): boolean {
  const q = query.toLowerCase();
  const h = haystack.toLowerCase();
  let i = 0;
  for (const c of h) {
    if (c === q[i]) i++;
    if (i === q.length) return true;
  }
  return i === q.length;
}

export function CommandPalette() {
  const router  = useRouter();
  const clerk   = useClerk();
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState("");
  const [active, setActive]     = useState(0);
  const [threads, setThreads]   = useState<ThreadItem[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  // ── Static items ────────────────────────────────────────────────────────
  const staticItems: StaticItem[] = useMemo(() => [
    // Navigation
    { kind: "nav",    id: "nav-home",       label: "Översikt",            icon: LayoutDashboard, href: "/app",                keywords: ["dashboard", "home", "start", "oversikt"] },
    { kind: "nav",    id: "nav-inbox",      label: "Inkorg",              icon: Mail,            href: "/app/inbox",          keywords: ["mail", "threads", "inbox"] },
    { kind: "nav",    id: "nav-inboxes",    label: "Anslutna inkorgar",   icon: InboxIcon,       href: "/app/inboxes",        keywords: ["connect", "anslut", "gmail", "outlook"] },
    { kind: "nav",    id: "nav-stats",      label: "Statistik",           icon: BarChart2,       href: "/app/stats",          keywords: ["stats", "metrics", "siffror", "analytics"] },
    { kind: "nav",    id: "nav-activity",   label: "Aktivitetslogg",      icon: Activity,        href: "/app/activity",       keywords: ["audit", "logg", "events", "history"] },
    { kind: "nav",    id: "nav-team",       label: "Team",                icon: Users,           href: "/app/team",           keywords: ["medlemmar", "invite", "members"] },
    { kind: "nav",    id: "nav-settings",   label: "Inställningar",       icon: Settings,        href: "/app/settings",       keywords: ["config", "settings", "installningar"] },
    { kind: "nav",    id: "nav-account",    label: "Mitt konto",          icon: Settings,        href: "/app/settings/account", keywords: ["profile", "konto", "language", "language"] },
    { kind: "nav",    id: "nav-billing",    label: "Fakturering & plan",  icon: CreditCard,      href: "/dashboard/billing",  keywords: ["billing", "plan", "stripe", "fakturera"] },

    // Quick actions
    { kind: "action", id: "act-new-thread", label: "Skapa testtråd",       icon: Plus,           href: "/app/inbox",           keywords: ["new", "thread", "test", "demo", "create"] },
    { kind: "action", id: "act-invite",     label: "Bjud in teammedlem",   icon: UserPlus,       href: "/app/team",            keywords: ["invite", "bjud", "ny", "medlem"] },
    { kind: "action", id: "act-knowledge",  label: "Lägg till kunskap",    icon: Sparkles,       href: "/app/settings",        keywords: ["knowledge", "kb", "fragor", "fakta"] },
    { kind: "action", id: "act-logout",     label: "Logga ut",             icon: LogOut,         onRun: () => clerk.signOut(),  keywords: ["logout", "signout", "sign", "logga"] },
  ], [clerk]);

  // ── Toggle open with ⌘K / Ctrl+K ──────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey;
      if (isCmd && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // ── Focus input + reset state when opening ────────────────────────────
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    setThreads([]);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ── Debounced thread search ───────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setThreads([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/app/threads?q=${encodeURIComponent(q)}&limit=8`, { cache: "no-store" });
        if (!res.ok) {
          setThreads([]);
          return;
        }
        const data = await res.json();
        const list: ThreadItem[] = (data.threads ?? []).map((t: {
          id: string;
          subject: string | null;
          fromEmail: string;
          fromName: string | null;
        }) => ({
          kind:  "thread",
          id:    `thread-${t.id}`,
          label: t.subject ?? "(inget ämne)",
          hint:  t.fromName ? `${t.fromName} <${t.fromEmail}>` : t.fromEmail,
          href:  `/app/inbox?thread=${t.id}`,
        }));
        setThreads(list);
      } catch {
        setThreads([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open]);

  // ── Filter static items by query ──────────────────────────────────────
  const filteredStatic = useMemo(() => {
    if (!query.trim()) return staticItems;
    const q = query.trim().toLowerCase();
    return staticItems.filter(item =>
      fuzzy(q, item.label) ||
      item.keywords.some(k => k.includes(q) || fuzzy(q, k))
    );
  }, [staticItems, query]);

  // ── All items in one flat list (for keyboard nav) ────────────────────
  const items: Item[] = useMemo(() => [...filteredStatic, ...threads], [filteredStatic, threads]);

  // Clamp active highlight as items change
  useEffect(() => {
    if (active >= items.length) setActive(Math.max(0, items.length - 1));
  }, [items.length, active]);

  // Scroll active into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    if (el && el instanceof HTMLElement) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [active]);

  // ── Run an item ───────────────────────────────────────────────────────
  const run = (item: Item) => {
    setOpen(false);
    if ("onRun" in item && item.onRun) {
      item.onRun();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  if (!open) return null;

  // Group helper for nav vs actions vs threads
  const groups: { title: string; items: Item[] }[] = [];
  const navs    = filteredStatic.filter(i => i.kind === "nav");
  const actions = filteredStatic.filter(i => i.kind === "action");
  if (navs.length)    groups.push({ title: "Navigera",    items: navs });
  if (actions.length) groups.push({ title: "Åtgärder",     items: actions });
  if (threads.length) groups.push({ title: "Trådar",       items: threads });

  // Build flat index map for keyboard nav highlighting
  let flatIdx = 0;
  const indexed = groups.map(g => ({
    ...g,
    items: g.items.map(i => ({ item: i, idx: flatIdx++ })),
  }));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cmd-palette-title"
      onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-[hsl(var(--surface-elev-1))]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
        onMouseDown={e => e.stopPropagation()}
      >
        <h2 id="cmd-palette-title" className="sr-only">Kommandopalett</h2>

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
          <Search size={16} className="text-white/40 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={e => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive(a => Math.min(a + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive(a => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const item = items[active];
                if (item) run(item);
              }
            }}
            placeholder="Sök eller skriv en åtgärd…"
            aria-label="Sök i Mailmind"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] text-white/40 border border-white/10 rounded px-1.5 py-0.5 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-1">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-white/45">Inga träffar för &ldquo;{query}&rdquo;</p>
              <p className="text-[11px] text-white/30 mt-1">Försök med ett enklare ord</p>
            </div>
          ) : (
            indexed.map((g, gi) => (
              <div key={gi} className="py-1">
                <p className="px-4 py-1 text-[10px] uppercase tracking-widest text-white/30 font-semibold">
                  {g.title}
                </p>
                {g.items.map(({ item, idx }) => {
                  const isActive = idx === active;
                  const Icon = item.kind === "thread" ? MessageSquare : (item as StaticItem).icon;
                  return (
                    <button
                      key={item.id}
                      data-idx={idx}
                      onClick={() => run(item)}
                      onMouseEnter={() => setActive(idx)}
                      className={[
                        "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                        "focus-visible:outline-none",
                        isActive
                          ? "bg-primary/10 text-white"
                          : "text-white/75 hover:text-white",
                      ].join(" ")}
                    >
                      <Icon size={15} className={isActive ? "text-primary shrink-0" : "text-white/40 shrink-0"} />
                      <span className="flex-1 min-w-0">
                        <span className="text-sm truncate block">{item.label}</span>
                        {"hint" in item && item.hint && (
                          <span className="text-[11px] text-white/40 truncate block">{item.hint}</span>
                        )}
                      </span>
                      {isActive && (
                        <ArrowRight size={13} className="text-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
          {searching && (
            <p className="px-4 py-2 text-[11px] text-white/30 animate-pulse">Söker trådar…</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-white/8 bg-[hsl(var(--surface-deep))]/50">
          <div className="flex items-center gap-3 text-[10px] text-white/35">
            <span className="flex items-center gap-1">
              <kbd className="border border-white/10 rounded px-1 py-0.5 font-mono"><ChevronUp size={9} /></kbd>
              <kbd className="border border-white/10 rounded px-1 py-0.5 font-mono"><ChevronDown size={9} /></kbd>
              navigera
            </span>
            <span className="flex items-center gap-1">
              <kbd className="border border-white/10 rounded px-1 py-0.5 font-mono">↵</kbd>
              välj
            </span>
          </div>
          <span className="text-[10px] text-white/30">Mailmind</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Trigger button for the palette — small icon-only button you can place in
 * headers or the sidebar. Listens to the same global event as the keyboard
 * shortcut by dispatching a synthetic ⌘K. Optional.
 */
export function CommandPaletteTrigger({ className }: { className?: string }) {
  const trigger = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  };
  return (
    <button
      onClick={trigger}
      aria-label="Öppna kommandopalett"
      title="Sök & navigera (⌘K)"
      className={["inline-flex items-center gap-2 h-7 px-2.5 rounded-lg border border-white/10 text-white/55 hover:text-white hover:bg-white/[0.04] hover:border-white/20 transition-colors text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50", className].filter(Boolean).join(" ")}
    >
      <Search size={11} />
      <span className="hidden sm:inline">Sök</span>
      <kbd className="hidden sm:inline-flex items-center text-[9px] text-white/40 border border-white/10 rounded px-1 font-mono">⌘K</kbd>
    </button>
  );
}
