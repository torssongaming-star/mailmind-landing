"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { createOrgNoteAction } from "@/lib/admin/actions";
import type { AdminNote } from "@/lib/db/schema";

export function OrgNotesPanel({
  orgId,
  initial,
}: {
  orgId:   string;
  initial: AdminNote[];
}) {
  const [notes,   setNotes]   = useState<AdminNote[]>(initial);
  const [content, setContent] = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const save = async () => {
    if (!content.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createOrgNoteAction(orgId, content.trim());
      // Optimistically prepend; revalidatePath will sync on next hard nav
      setNotes(prev => [{
        id:                   crypto.randomUUID(),
        subjectType:          "organization",
        targetOrganizationId: orgId,
        targetClerkUserId:    null,
        authorClerkUserId:    "",
        content:              content.trim(),
        createdAt:            new Date(),
        updatedAt:            new Date(),
      } as AdminNote, ...prev]);
      setContent("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte spara");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-6 space-y-6">
      <h3 className="text-white text-sm font-bold uppercase tracking-widest border-b border-white/5 pb-3">
        Internal Notes
      </h3>

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Add internal context..."
        className="w-full bg-[#030614] border border-white/10 rounded-xl p-3 text-xs text-white focus:border-primary/50 outline-none h-24 transition-all resize-none placeholder:text-white/20"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={save}
        disabled={saving || !content.trim()}
        className="w-full py-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {saving && <Loader2 className="w-3 h-3 animate-spin" />}
        {saving ? "Sparar…" : "Add Organization Note"}
      </button>

      {notes.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-white/5">
          {notes.map(note => (
            <div key={note.id} className="p-3 bg-white/[0.02] rounded-lg border border-white/5">
              <span className="text-slate-600 text-[9px] block mb-1">
                {format(new Date(note.createdAt), "PPp")}
              </span>
              <p className="text-slate-400 text-xs leading-relaxed">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
