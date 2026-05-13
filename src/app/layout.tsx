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
    default: `Mailmind | AI Email Support for European B2B Teams`,
    template: `%s | Mailmind`,
  },
  description: siteConfig.description,
  keywords: ["Mailmind", "AI email support", "customer email AI", "Outlook AI", "Gmail AI", "B2B email automation", "GDPR email tool", "European AI support"],
  metadataBase: new URL(siteConfig.siteUrl),
  alternates: {
    canonical: siteConfig.siteUrl,
  },
  openGraph: {
    title: `Mailmind | AI Email Support for B2B`,
    description: siteConfig.description,
    url: siteConfig.siteUrl,
    siteName: "Mailmind",
    locale: "sv_SE",
    type: "website",
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: "Mailmind — AI email support",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `Mailmind | AI Email Support`,
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
    <html lang="sv" className="dark">
      <body className={`${inter.className} min-h-screen bg-background antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Mailmind",
              "url": "https://mailmind.se",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "description": siteConfig.description,
              "offers": {
                "@type": "Offer",
                "priceCurrency": "SEK",
                "availability": "https://schema.org/InStock"
              },
              "publisher": {
                "@type": "Organization",
                "name": "Mailmind",
                "url": "https://mailmind.se"
              }
            })
          }}
        />
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
