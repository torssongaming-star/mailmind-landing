export const siteConfig = {
  siteName: "Mailmind",
  appName: "Mailmind",
  siteUrl: "https://mailmind.se",
  domain: "mailmind.se",
  description: "AI-assisted customer email support for European businesses.",
  supportEmail: "support@mailmind.se",
  billingEmail: "billing@mailmind.se",
  demoEmail: "demo@mailmind.se",
  contactEmail: "hello@mailmind.se",
  ogImage: "https://mailmind.se/og-image.png",
  twitterHandle: "",
} as const;

export type SiteConfig = typeof siteConfig;
