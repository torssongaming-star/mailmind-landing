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

      <div className="bg-[#050B1C] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
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
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic text-sm">
                    No users found in the system.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

