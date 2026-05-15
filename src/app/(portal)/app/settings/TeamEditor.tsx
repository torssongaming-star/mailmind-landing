"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

const ROLE_LABELS: Record<string, string> = {
  owner:  "Ägare",
  admin:  "Administratör",
  member: "Medlem",
};

const ROLE_COLORS: Record<string, string> = {
  owner:  "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  admin:  "text-violet-400 bg-violet-500/10 border-violet-500/20",
  member: "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

export function TeamEditor({
  initialMembers,
  initialInvites,
  currentUserId,
  currentUserRole,
  seatLimit,
}: {
  initialMembers:   Member[];
  initialInvites:   Invite[];
  currentUserId:    string;
  currentUserRole:  string;
  seatLimit:        number;
}) {
  const router = useRouter();
  const [members, setMembers]   = useState(initialMembers);
  const [invites, setInvites]   = useState(initialInvites);
  const [email, setEmail]       = useState("");
  const [role, setRole]         = useState<"admin" | "member">("member");
  const [pending, setPending]   = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  const isOwner = currentUserRole === "owner";
  const isAdmin = currentUserRole === "admin";
  const canManage = isOwner || isAdmin;

  const refresh = () => router.refresh();

  const sendInvite = async () => {
    if (!email.trim()) return;
    setError(null); setSuccess(null); setPending("invite");
    try {
      const res = await fetch("/api/app/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Kunde inte skicka inbjudan");
      setInvites(prev => [...prev, { ...data.invite, createdAt: new Date(), expiresAt: new Date(Date.now() + 72 * 3600 * 1000) }]);
      setEmail(""); setSuccess(`Inbjudan skickad till ${data.invite.email}`);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(null);
    }
  };

  const cancelInvite = async (inviteId: string) => {
    setError(null); setPending(`cancel-${inviteId}`);
    try {
      const res = await fetch(`/api/app/team/invites/${inviteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Kunde inte avbryta inbjudan");
      setInvites(prev => prev.filter(i => i.id !== inviteId));
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(null);
    }
  };

  const changeRole = async (memberId: string, newRole: "admin" | "member") => {
    setError(null); setPending(`role-${memberId}`);
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
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(null);
    }
  };

  const removeMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Ta bort ${memberEmail} från arbetsytan?`)) return;
    setError(null); setPending(`remove-${memberId}`);
    try {
      const res = await fetch(`/api/app/team/members/${memberId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Kunde inte ta bort medlem");
      }
      setMembers(prev => prev.filter(m => m.id !== memberId));
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Okänt fel");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-6">

      {/* Error / success */}
      {error   && <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">{error}</div>}
      {success && <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs text-green-400">{success}</div>}

      {/* Members list */}
      <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-white">Medlemmar</h3>
          <span className="text-xs text-muted-foreground">{members.length}/{seatLimit} platser</span>
        </div>

        <div className="divide-y divide-white/5">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between py-3 gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{m.email}</p>
                {m.id === currentUserId && (
                  <p className="text-[10px] text-muted-foreground">Du</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Role badge / dropdown for owner */}
                {isOwner && m.role !== "owner" && m.id !== currentUserId ? (
                  <select
                    value={m.role}
                    disabled={pending === `role-${m.id}`}
                    onChange={e => changeRole(m.id, e.target.value as "admin" | "member")}
                    className="text-xs bg-white/5 border border-white/10 text-white rounded-md px-2 py-1 focus:outline-none focus:border-primary/50"
                  >
                    <option value="admin">Administratör</option>
                    <option value="member">Medlem</option>
                  </select>
                ) : (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_COLORS[m.role] ?? ROLE_COLORS.member}`}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                )}

                {/* Remove button */}
                {canManage && m.role !== "owner" && m.id !== currentUserId && (
                  <button
                    onClick={() => removeMember(m.id, m.email)}
                    disabled={!!pending}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Ta bort
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5 space-y-2">
          <h3 className="text-sm font-semibold text-white mb-3">Väntande inbjudningar</h3>
          <div className="divide-y divide-white/5">
            {invites.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{inv.email}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {ROLE_LABELS[inv.role] ?? inv.role} · Går ut {new Date(inv.expiresAt).toLocaleDateString("sv-SE")}
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={() => cancelInvite(inv.id)}
                    disabled={pending === `cancel-${inv.id}`}
                    className="text-xs text-muted-foreground hover:text-white transition-colors shrink-0"
                  >
                    {pending === `cancel-${inv.id}` ? "Avbryter…" : "Avbryt"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite form */}
      {canManage && members.length < seatLimit && (
        <div className="rounded-2xl border border-white/8 bg-[#050B1C]/60 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Bjud in en kollega</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">E-postadress</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendInvite()}
                placeholder="kollega@foretag.se"
                className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-primary/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Roll</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as "admin" | "member")}
                className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:border-primary/50 focus:outline-none"
              >
                <option value="member">Medlem — kan hantera ärenden</option>
                {isOwner && <option value="admin">Administratör — kan bjuda in + inställningar</option>}
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              onClick={sendInvite}
              disabled={pending === "invite" || !email.trim()}
              className="px-4 py-1.5 rounded-lg bg-primary text-[#030614] text-xs font-semibold hover:bg-cyan-300 transition-colors disabled:opacity-40"
            >
              {pending === "invite" ? "Skickar…" : "Skicka inbjudan"}
            </button>
          </div>
        </div>
      )}

      {canManage && members.length >= seatLimit && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
          Platserna är fulla ({members.length}/{seatLimit}).{" "}
          <a href="/dashboard/billing" className="underline">Uppgradera din plan</a> för fler platser.
        </div>
      )}
    </div>
  );
}
