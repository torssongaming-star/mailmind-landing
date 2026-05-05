import type { Metadata } from "next";
import { Sidebar } from "@/components/portal/Sidebar";

export const metadata: Metadata = {
  title: "Dashboard — Mailmind",
  description: "Manage your Mailmind account, plan and usage.",
};

/**
 * Portal layout — solid dark background that sits above the global
 * AnimatedBackground (fixed, -z-10), so the star field does not
 * distract from the data-focused dashboard UI.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#030614] flex">
      <Sidebar />
      {/* Main content area — offset by sidebar width */}
      <div className="flex-1 flex flex-col min-h-screen ml-64">
        {children}
      </div>
    </div>
  );
}
