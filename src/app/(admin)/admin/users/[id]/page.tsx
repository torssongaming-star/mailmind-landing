import { getAdminUser, listAdminNotes } from "@/lib/admin/queries";
import { User as UserIcon, Building2, ShieldCheck, Mail, Lock, History, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminNote } from "@/lib/db/schema";
import React from "react";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAdminUser(id);
  const notes = await listAdminNotes(id, "user");

  if (!user) notFound();

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-2xl">
            <UserIcon className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <h1 className="text-white text-3xl font-bold tracking-tight">{user.email}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-slate-500 text-xs font-mono">{user.clerkUserId}</span>
              <span className="text-slate-700">•</span>
              <span className="text-primary text-[10px] font-bold uppercase tracking-widest">{user.role}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-xs font-bold uppercase tracking-widest transition-all">
            Inaktivera Konto
          </button>
          <button className="px-4 py-2 bg-primary text-black hover:bg-cyan-300 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
            Reset Password
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-8 space-y-6">
            <h2 className="text-white font-bold flex items-center gap-2 border-b border-white/5 pb-4">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Account Details
            </h2>
            
            <div className="grid grid-cols-2 gap-8">
              <DetailItem label="Email Address" value={user.email} icon={Mail} />
              <DetailItem label="Joined Mailmind" value={format(new Date(user.createdAt), "PPP")} icon={History} />
              <DetailItem label="Role in Team" value={user.role} icon={ShieldCheck} />
              <DetailItem label="Organization" value={user.organization?.name || "N/A"} icon={Building2} />
            </div>
          </div>

          <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-8 space-y-6">
            <h2 className="text-white font-bold flex items-center gap-2 border-b border-white/5 pb-4">
              <Lock className="w-5 h-5 text-violet-500" />
              Security Status
            </h2>
            <div className="flex items-center gap-4 p-4 bg-violet-500/5 border border-violet-500/10 rounded-xl">
               <AlertCircle className="w-5 h-5 text-violet-400" />
               <p className="text-violet-200/60 text-xs">
                 Lösenord kan aldrig visas eller ändras direkt av administratörer. 
                 Använd "Reset Password" för att skicka instruktioner till användaren.
               </p>
            </div>
          </div>

          {/* Internal Notes */}
          <div className="space-y-4">
            <h2 className="text-white font-bold flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Internal Notes
            </h2>
            <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-6 space-y-6">
              <textarea 
                placeholder="Add an internal note about this user..."
                className="w-full bg-[#030614] border border-white/10 rounded-xl p-4 text-sm text-white focus:border-primary/50 outline-none h-32 transition-all resize-none"
              />
              <div className="flex justify-end">
                <button className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-lg text-xs font-bold uppercase tracking-widest transition-all">
                  Save Note
                </button>
              </div>

              <div className="space-y-4 mt-8 pt-8 border-t border-white/5">
                {notes.map((note: AdminNote) => (
                  <div key={note.id} className="p-4 bg-white/[0.02] rounded-xl border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Admin Action</span>
                      <span className="text-slate-600 text-[10px]">{format(new Date(note.createdAt), "PPp")}</span>
                    </div>
                    <p className="text-slate-300 text-sm">{note.content}</p>
                  </div>
                ))}
                {notes.length === 0 && (
                  <p className="text-slate-500 text-xs italic text-center py-4">No internal notes for this user.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
           <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-6 space-y-6">
             <h3 className="text-white text-sm font-bold uppercase tracking-widest border-b border-white/5 pb-3">Organization</h3>
             {user.organization ? (
               <div className="space-y-4">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center border border-primary/10 text-primary">
                     <Building2 className="w-5 h-5" />
                   </div>
                   <div className="flex flex-col">
                     <span className="text-white text-sm font-bold">{user.organization.name}</span>
                     <span className="text-slate-500 text-[10px]">{user.organization.id}</span>
                   </div>
                 </div>
                 <Link 
                   href={`/admin/organizations/${user.organizationId}`}
                   className="block text-center w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all"
                 >
                   View Organization
                 </Link>
               </div>
             ) : (
               <p className="text-slate-500 text-xs italic">User is not part of any organization.</p>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, icon: Icon }: { label: string, value: string, icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-slate-600" />
        {label}
      </span>
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  );
}
