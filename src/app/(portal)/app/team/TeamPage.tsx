"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, ChevronDown } from "lucide-react";
import { useToast, ToastContainer } from "@/components/ui/Toast";

type Member = {
  id:        string;
  email:     string;
  role:      string;
  createdAt: Date | string;
};

type Invite = {
  id:        string;
  email:     string;
  role:      string;
  expiresAt: Date | string;
  createdAt: Date | string;
};

const ROLE_LABEL: Record<string, string> = {
  owner:  "Ägare",
  admin:  "Admin",
  member: "Medlem",
};

const ROLE_COLOR: Record<string, string> = {
  owner:  "text-cyan-400   bg-cyan-500/10   border-cyan-500/25",
  admin:  "text-violet-400 bg-violet-500/10 border-violet-500/25",
  member: "text-slate-400  bg-slate-500/10  border-slate-500/20",
};

/** Deterministic avatar colour from email string */
function avatarColor(email: string): string {
  const palette = [
    "bg-cyan-500/20   text-cyan-300",
    "bg-violet-500/20 text-violet-300",
    "bg-emerald-500/20 text-emerald-300",
    "bg-amber-500/20  text-amber-300",
    "bg-pink-500/20   text-pink-300",
    "bg-sky-500/20    text-sky-300",
  ];
  let hash = 0;
  for (const c of email) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return palette[hash % palette.length];
}

function Avatar({ email }: { email: string }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(email)}`}>
      {email[0]?.toUpperCase()}
    </div>
  );
}

export function TeamPage({
  initialMembers,
  initialInvites,
  currentUserId,
  currentUserRole,
  seatLimit,
  orgName,
}: {
  initialMembers:  Member[];
  initialInvites:  Invite[];
  currentUserId:   string;
  currentUserRole: string;
  seatLimit:       number;
  orgName:         string;
}) {
  const router = useRouter();
  const { toasts, toast, dismiss } = useToast();
  const [members, setMembers]   = useState(initialMembers);
  const [invites, setInvites]   = useState(initialInvites);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail]       = useState("");
  const [role, setRole]         = useState<"admin" | "member">("member");
  const [pending, setPending]   = useState<string | null>(null);

  const isOwner    = currentUserRole === "owner";
  const isAdmin    = currentUserRole === "admin";
  const canManage  = isOwner || isAdmin;
  const seatsUsed  = members.length;
  const seatsFull  = seatsUsed >= seatLimit;

  const refresh = () => router.refresh();

  const sendInvite = async () => {
    if (!email.trim()) return;
    setPending("invite");
    try {
      const res = await fetch("/api/app/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Kunde inte skicka inbjudan");

      setInvites(prev => [...prev, {
        ...data.invite,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      }]);
      setEmail("");
      setInviteOpen(false);
      refresh();

      if (data.emailSent) {
        toast.success(`Inbjudan skickad till ${data.invite.email}`);
      } else {
        // Email failed — show link to copy manually
        toast.warning("Inbjudan skapad men mejlet gick inte att skicka.", {
          detail: "Kopiera länken nedan och skicka den manuellt.",
          duration: 12000,
        });
        if (data.acceptLink) {
          navigator.clipboard.writeText(data.acceptLink).catch(() => {});
          toast.info("Inbjudningslänken kopierades till urklipp.", { duration: 8000 });
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(null);
    }
  };

  const cancelInvite = async (inviteId: string) => {
    setPending(`cancel-${inviteId}`);
    try {
      const res = await fetch(`/api/app/team/invites/${inviteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Kunde inte avbryta inbjudan");
      setInvites(prev => prev.filter(i => i.id !== inviteId));
      toast.info("Inbjudan avbruten.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(null);
    }
  };

  const changeRole = async (memberId: string, newRole: "admin" | "member") => {
    setPending(`role-${memberId}`);
    try {
      const res = await fetch(`/api/app/team/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Kunde inte ändra roll");
      }
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      toast.success(`Roll uppdaterad till ${newRole === "admin" ? "Admin" : "Medlem"}.`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(null);
    }
  };

  const removeMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Ta bort ${memberEmail} från ${orgName}?`)) return;
    setPending(`remove-${memberId}`);
    try {
      const res = await fetch(`/api/app/team/members/${memberId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Kunde inte ta bort medlem");
      }
      setMembers(prev => prev.filter(m => m.id !== memberId));
      toast.success(`${memberEmail} har tagits bort.`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(null);
    }
  };

  return (
    <main className="max-w-3xl mx-auto p-6 md:p-10 space-y-8">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">App</p>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Hantera teammedlemmar och roller för{" "}
            <span className="text-white/60">{orgName}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 pt-1">
          {/* Seat counter */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03]">
            <span className="text-xs font-semibold text-white">{seatsUsed}</span>
            <span className="text-xs text-white/30">/</span>
            <span className="text-xs text-white/50">{seatLimit}</span>
            <span className="text-[10px] text-white/30 ml-0.5">platser</span>
          </div>

          {/* Invite CTA */}
          {canManage && !seatsFull && (
            <button
              onClick={() => setInviteOpen(v => !v)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors"
            >
              <UserPlus size={13} />
              Bjud in
            </button>
          )}
        </div>
      </div>

      {/* ── Invite panel (inline, no modal) ─────────────────────────────── */}
      {inviteOpen && (
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Bjud in en kollega</p>
            <button onClick={() => setInviteOpen(false)} className="text-white/30 hover:text-white transition-colors">
              <X size={15} />
            </button>
          </div>

          <div className="grid sm:grid-cols-[1fr_180px_auto] gap-3 items-end">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">E-postadress</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendInvite()}
                placeholder="kollega@foretag.se"
                autoFocus
                className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-primary/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Roll</label>
              <div className="relative">
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as "admin" | "member")}
                  className="w-full appearance-none bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-primary/50 focus:outline-none pr-7"
                >
                  <option value="member">Medlem</option>
                  {isOwner && <option value="admin">Admin</option>}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              </div>
            </div>
            <button
              onClick={sendInvite}
              disabled={pending === "invite" || !email.trim()}
              className="px-4 py-2 rounded-lg bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {pending === "invite" ? "Skickar…" : "Skicka →"}
            </button>
          </div>

          <p className="text-[10px] text-white/25">
            Inbjudan är giltig i 72 timmar. Mottagaren behöver ett Mailmind-konto (eller skapar ett gratis vid accept).
          </p>
        </div>
      )}

      {/* ── Members list ────────────────────────────────────────────────── */}
      <section className="space-y-1">
        <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold px-1 mb-3">
          Aktiva medlemmar
        </p>

        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 overflow-hidden divide-y divide-white/5">
          {members.map(m => {
            const isSelf    = m.id === currentUserId;
            const isThisOwner = m.role === "owner";
            const canEdit   = isOwner && !isThisOwner && !isSelf;

            return (
              <div key={m.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors group">
                <Avatar email={m.email} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-white font-medium truncate">{m.email}</span>
                    {isSelf && (
                      <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full border border-white/8">
                        du
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    Gick med {new Date(m.createdAt).toLocaleDateString("sv-SE")}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {canEdit ? (
                    <div className="relative">
                      <select
                        value={m.role}
                        disabled={pending === `role-${m.id}`}
                        onChange={e => changeRole(m.id, e.target.value as "admin" | "member")}
                        className="appearance-none text-xs bg-white/5 border border-white/10 text-white rounded-md px-2.5 py-1 pr-6 focus:outline-none focus:border-primary/50 cursor-pointer hover:bg-white/10 transition-colors"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Medlem</option>
                      </select>
                      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                    </div>
                  ) : (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_COLOR[m.role] ?? ROLE_COLOR.member}`}>
                      {ROLE_LABEL[m.role] ?? m.role}
                    </span>
                  )}

                  {canManage && !isThisOwner && !isSelf && (
                    <button
                      onClick={() => removeMember(m.id, m.email)}
                      disabled={!!pending}
                      className="opacity-0 group-hover:opacity-100 text-[11px] text-red-400/70 hover:text-red-300 transition-all"
                    >
                      Ta bort
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Pending invites ─────────────────────────────────────────────── */}
      {invites.length > 0 && (
        <section className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold px-1 mb-3">
            Väntande inbjudningar
          </p>

          <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 overflow-hidden divide-y divide-white/5">
            {invites.map(inv => {
              const daysLeft = Math.ceil(
                (new Date(inv.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              return (
                <div key={inv.id} className="flex items-center gap-4 px-5 py-3.5 group">
                  {/* Dashed avatar for pending */}
                  <div className="w-8 h-8 rounded-full border border-dashed border-white/20 flex items-center justify-center shrink-0">
                    <span className="text-xs text-white/30">{inv.email[0]?.toUpperCase()}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white/70 truncate">{inv.email}</span>
                    <p className="text-[11px] text-white/30 mt-0.5">
                      {ROLE_LABEL[inv.role] ?? inv.role} · {daysLeft > 0 ? `Går ut om ${daysLeft} dag${daysLeft !== 1 ? "ar" : ""}` : "Utgången"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      Väntande
                    </span>
                    {canManage && (
                      <button
                        onClick={() => cancelInvite(inv.id)}
                        disabled={pending === `cancel-${inv.id}`}
                        className="opacity-0 group-hover:opacity-100 text-[11px] text-white/40 hover:text-white transition-all"
                      >
                        {pending === `cancel-${inv.id}` ? "Avbryter…" : "Avbryt"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Seat limit warning ──────────────────────────────────────────── */}
      {seatsFull && canManage && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300 flex items-center justify-between">
          <span>Alla {seatLimit} platser är fyllda.</span>
          <a href="/dashboard/billing" className="underline hover:text-amber-200 transition-colors">
            Uppgradera för fler →
          </a>
        </div>
      )}

    </main>
  );
}
