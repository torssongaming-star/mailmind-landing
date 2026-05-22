import { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/"],
      // Authed routes are middleware-gated anyway, but explicitly disallowing
      // them keeps inevitable crawler 401s out of Search Console and stops
      // accidental indexing of staging links / API endpoints.
      disallow: ["/app", "/dashboard", "/admin", "/api"],
    },
    sitemap: `${siteConfig.siteUrl}/sitemap.xml`,
  };
}
