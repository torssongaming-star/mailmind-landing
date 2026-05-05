import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — Mailmind",
  description: "Sign in to your Mailmind account.",
};

/**
 * Auth layout — centered on screen, no sidebar, no star background overlay.
 * The global AnimatedBackground (fixed, -z-10) still shows through,
 * giving the auth pages the same premium starfield feel.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      {/* Subtle central glow */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center -z-[5]">
        <div className="w-[600px] h-[600px] bg-primary/8 rounded-full blur-[120px]" />
      </div>
      {children}
    </div>
  );
}
