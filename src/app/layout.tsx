import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AnimatedBackground } from "@/components/design-system/AnimatedBackground";
import { MotionProvider } from "@/components/layout/MotionProvider";
import { Providers } from "@/components/layout/Providers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { siteConfig } from "@/config/site";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.siteName} | AI Email Support for European B2B Teams`,
    template: `%s | ${siteConfig.siteName}`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.siteUrl),
  openGraph: {
    title: `${siteConfig.siteName} | AI Email Support for B2B`,
    description: siteConfig.description,
    url: siteConfig.siteUrl,
    siteName: siteConfig.siteName,
    locale: "en_IE",
    type: "website",
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.siteName} | Premium AI Email Support`,
    description: siteConfig.description,
    creator: siteConfig.twitterHandle || undefined,
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
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
