"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tag, X, Plus } from "lucide-react";

export function TagEditor({
  threadId,
  initialTags,
}: {
  threadId:    string;
  initialTags: string[];
}) {
  const router  = useRouter();
  const [tags, setTags]         = useState<string[]>(initialTags);
  const [input, setInput]       = useState("");
  const [pending, setPending]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const save = async (next: string[]) => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/threads/${threadId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tags: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Kunde inte spara");
      setTags(data.tags ?? next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(false);
    }
  };

  const addTag = () => {
    const value = input.trim().toLowerCase();
    if (!value || tags.includes(value) || tags.length >= 20) return;
    const next = [...tags, value];
    setTags(next);
    setInput("");
    save(next);
  };

  const removeTag = (tag: string) => {
    const next = tags.filter(t => t !== tag);
    setTags(next);
    save(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
    if (e.key === "Backspace" && input === "" && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap items-center gap-1.5 min-h-[36px] px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] cursor-text focus-within:border-primary/40 transition-colors"
        onClick={() => inputRef.current?.focus()}
      >
        <Tag className="w-3 h-3 text-slate-500 shrink-0" />
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20"
          >
            <Link
              href={`/app/inbox?tag=${encodeURIComponent(tag)}`}
              onClick={e => e.stopPropagation()}
              className="hover:text-white transition-colors"
            >
              {tag}
            </Link>
            <button
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              disabled={pending}
              className="hover:text-white transition-colors disabled:opacity-40"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => { if (input.trim()) addTag(); }}
          placeholder={tags.length === 0 ? "Lägg till tagg…" : ""}
          disabled={pending}
          className="flex-1 min-w-[80px] bg-transparent text-xs text-white outline-none placeholder:text-slate-600 disabled:opacity-40"
        />
        {input.trim() && (
          <button
            onClick={addTag}
            disabled={pending}
            className="shrink-0 p-0.5 rounded text-primary hover:text-white transition-colors disabled:opacity-40"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>
      {error && (
        <p className="text-[10px] text-red-400 px-1">{error}</p>
      )}
      <p className="text-[10px] text-slate-600 px-1">
        Enter eller komma för att lägga till. Klicka × för att ta bort.
      </p>
    </div>
  );
}
