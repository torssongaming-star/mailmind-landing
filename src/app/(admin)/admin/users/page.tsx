import { listAdminUsers } from "@/lib/admin/queries";
import Link from "next/link";
import { Search, ChevronRight, User as UserIcon } from "lucide-react";
import { format } from "date-fns";
import { User, Organization } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export default async function AdminUsersPage() {
  const users = await listAdminUsers();

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-white text-2xl sm:text-3xl font-bold tracking-tight mb-2">User Management</h1>
          <p className="text-slate-400 text-sm">View and manage all registered users.</p>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search email..." 
            className="bg-[#050B1C] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:border-primary/50 outline-none w-full transition-all"
          />
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-[#050B1C] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">User</th>
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Organization</th>
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Role</th>
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Joined</th>
                <th className="px-6 py-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user: User & { organization: Organization | null }) => (
                <tr key={user.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                        <UserIcon className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white text-sm font-medium">{user.email}</span>
                        <span className="text-slate-500 text-[10px] font-mono">{user.clerkUserId}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-slate-300 text-sm">
                      {user.organization?.name || "No Organization"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      user.role === "owner" ? "bg-primary/10 text-primary" : "bg-white/5 text-slate-400"
                    )}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {format(new Date(user.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-6 py-4">
                    <Link 
                      href={`/admin/users/${user.clerkUserId}`}
                      className="text-primary hover:text-cyan-300 transition-colors flex items-center gap-1 text-xs font-bold uppercase tracking-widest"
                    >
                      Manage
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {users.map((user: User & { organization: Organization | null }) => (
          <div key={user.id} className="bg-[#050B1C] border border-white/5 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                  <UserIcon className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-white text-sm font-bold truncate">{user.email}</span>
                  <span className="text-slate-500 text-[10px] font-mono truncate">{user.clerkUserId}</span>
                </div>
              </div>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0",
                user.role === "owner" ? "bg-primary/10 text-primary" : "bg-white/5 text-slate-400"
              )}>
                {user.role}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/5">
              <div className="flex flex-col gap-1">
                <span className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Organization</span>
                <span className="text-slate-200 text-xs truncate">
                  {user.organization?.name || "None"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Joined</span>
                <span className="text-slate-200 text-xs">
                  {format(new Date(user.createdAt), "MMM d, yyyy")}
                </span>
              </div>
            </div>

            <Link 
              href={`/admin/users/${user.clerkUserId}`}
              className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-primary rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
            >
              Manage User
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ))}
      </div>

      {users.length === 0 && (
        <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-12 text-center text-slate-500 italic text-sm">
          No users found in the system.
        </div>
      )}
    </div>
  );
}

