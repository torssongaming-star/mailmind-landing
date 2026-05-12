import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { AdminMobileMenu } from "./AdminMobileMenu";

export async function AdminHeader() {
  const user = await currentUser();

  return (
    <header className="h-16 border-b border-white/5 bg-[#030614]/50 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-8">
      <div className="flex items-center gap-4">
        <AdminMobileMenu />
        <span className="text-slate-500 text-sm hidden sm:inline">Admin Portal</span>
        <span className="text-slate-700 hidden sm:inline">/</span>
        <span className="text-white text-sm font-medium uppercase tracking-wider">Internal View</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end mr-2">
          <span className="text-white text-xs font-bold">{user?.emailAddresses[0]?.emailAddress}</span>
          <span className="text-primary text-[10px] font-bold uppercase tracking-widest">
            {user?.privateMetadata?.mailmindRole as string || "Admin"}
          </span>
        </div>
        <UserButton 
          appearance={{
            elements: {
              userButtonAvatarBox: "w-8 h-8 rounded-lg border border-white/10",
            }
          }}
        />
      </div>
    </header>
  );
}
