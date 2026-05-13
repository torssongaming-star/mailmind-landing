import type { Metadata } from "next";
import { Sidebar } from "@/components/portal/Sidebar";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: {
    default: `Dashboard | ${siteConfig.siteName}`,
    template: `%s | ${siteConfig.siteName}`,
  },
  description: `Manage your ${siteConfig.siteName} account, plan and usage.`,
};

/**
 * Portal layout — solid dark background that sits above the global
 * AnimatedBackground (fixed, -z-10), so the star field does not
 * distract from the data-focused dashboard UI.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#030614]">
      <Sidebar />
      {/* Main content area — offset by sidebar width on desktop; on mobile the
          sticky mobile header inside <Sidebar> sits above this block. */}
      <div className="flex flex-col min-h-screen lg:ml-64">
        {children}
      </div>
    </div>
  );
}
