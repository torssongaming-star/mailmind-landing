export const siteConfig = {
  siteName: "Mailmind",
  appName: "Mailmind",
  siteUrl: "https://mailmind.se",
  domain: "mailmind.se",
  description: "Mailmind is an AI-powered email support tool for European B2B teams. Connect Outlook or Gmail, let Mailmind draft replies and summarize threads — while your team keeps full control.",
  supportEmail: "support@mailmind.se",
  billingEmail: "billing@mailmind.se",
  demoEmail: "demo@mailmind.se",
  contactEmail: "hello@mailmind.se",
  securityEmail: "security@mailmind.se",
  ogImage: "https://mailmind.se/og-image.png",
  twitterHandle: "",
} as const;

export type SiteConfig = typeof siteConfig;
