import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://*.outlook.com https://*.office.com https://*.office365.com https://outlook.office.com https://outlook.office365.com https://outlook.live.com https://*.msappproxy.net https://*.microsoft.com;",
          },
        ],
      },
      {
        // Explicitly cover the root path as well
        source: "/",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://*.outlook.com https://*.office.com https://*.office365.com https://outlook.office.com https://outlook.office365.com https://outlook.live.com https://*.msappproxy.net https://*.microsoft.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
