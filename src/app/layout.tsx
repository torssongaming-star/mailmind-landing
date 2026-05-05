import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AnimatedBackground } from "@/components/design-system/AnimatedBackground";
import { MotionProvider } from "@/components/layout/MotionProvider";
import { Providers } from "@/components/layout/Providers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mailmind | AI Email Support for European B2B Teams",
  description: "Connect your existing inbox. Let AI draft replies, summarize threads and organize customer emails with human-in-the-loop control.",
  openGraph: {
    title: "Mailmind | AI Email Support for B2B",
    description: "Designed for European businesses. Answer customer emails faster with AI-assisted drafting, categorization, and human-in-the-loop workflows.",
    url: "https://mailmind.io",
    siteName: "Mailmind",
    locale: "en_IE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mailmind | Premium AI Email Support",
    description: "Connect Outlook or Gmail. Draft replies, summarize long threads, and organize your inbox—while your team approves every response.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-background antialiased`}>
        <AnimatedBackground />
        <Providers>
          <MotionProvider>
            {children}
          </MotionProvider>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
