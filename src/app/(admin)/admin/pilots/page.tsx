import { db } from "@/lib/db";
import { adminCustomerProfiles, organizations } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Rocket, Calendar, User, Building2, ChevronRight, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default async function AdminPilotsPage() {
  const profiles = await db.select({
    profile: adminCustomerProfiles,
    org: organizations,
  })
  .from(adminCustomerProfiles)
  .leftJoin(organizations, eq(adminCustomerProfiles.organizationId, organizations.id))
  .orderBy(desc(adminCustomerProfiles.createdAt));

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-3xl font-bold tracking-tight mb-2">Pilot & Enterprise</h1>
          <p className="text-slate-400">Manage high-touch customers and enterprise leads.</p>
        </div>
        
        <button className="px-4 py-2 bg-primary text-black hover:bg-cyan-300 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
          New Pilot Lead
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {profiles.map(({ profile, org }) => (
          <div key={profile.id} className="bg-[#050B1C] border border-white/5 rounded-2xl p-8 hover:border-primary/20 transition-all group shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-start gap-8">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
                    profile.status === "pilot" ? "bg-primary/10 text-primary border border-primary/20" : 
                    profile.status === "enterprise_customer" ? "bg-violet-500/10 text-violet-500 border border-violet-500/20" :
                    "bg-white/5 text-slate-400 border border-white/10"
                  )}>
                    {profile.status.replace(/_/g, " ")}
                  </span>
                  <span className="text-slate-700">•</span>
                  <span className="text-slate-500 text-xs">Created {format(new Date(profile.createdAt), "MMM d, yyyy")}</span>
                </div>

                <div className="flex items-center gap-3">
                  <h2 className="text-white text-2xl font-bold tracking-tight">
                    {org?.name || profile.ownerName || "Untitled Prospect"}
                  </h2>
                </div>

                <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
                  {profile.summary || "No summary provided for this pilot lead."}
                </p>

                <div className="flex flex-wrap gap-6 pt-4">
                  <div className="flex items-center gap-2 text-slate-300">
                    <User className="w-4 h-4 text-slate-500" />
                    <span className="text-sm">{profile.contactName || "No contact"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span className="text-sm">
                      {profile.nextFollowUpAt ? `Follow-up: ${format(new Date(profile.nextFollowUpAt), "MMM d")}` : "No follow-up set"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 w-full lg:w-48">
                {profile.organizationId && (
                  <Link 
                    href={`/admin/organizations/${profile.organizationId}`}
                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-[10px] font-bold uppercase tracking-widest text-center transition-all flex items-center justify-center gap-2"
                  >
                    <Building2 className="w-3 h-3" />
                    View Org
                  </Link>
                )}
                <button className="w-full py-2.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-xl text-[10px] font-bold uppercase tracking-widest text-center transition-all flex items-center justify-center gap-2">
                  <MessageSquare className="w-3 h-3" />
                  Edit Profile
                </button>
              </div>
            </div>
          </div>
        ))}

        {profiles.length === 0 && (
          <div className="bg-[#050B1C] border border-white/5 rounded-2xl p-12 text-center space-y-4 shadow-xl">
             <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 mx-auto">
               <Rocket className="w-8 h-8 text-slate-600" />
             </div>
             <div>
               <h3 className="text-white font-bold">No Pilot Leads Yet</h3>
               <p className="text-slate-500 text-sm mt-1">Start tracking enterprise prospects and pilot users here.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
