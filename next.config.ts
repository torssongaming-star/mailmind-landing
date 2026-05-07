import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/addins/outlook/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://outlook.office.com https://outlook.office365.com https://outlook.live.com https://outlook-sdf.office.com https://*.outlook.com;",
          },
          {
            key: "X-Frame-Options",
            value: "ALLOW-FROM https://outlook.office.com", // Fallback for older browsers
          },
        ],
      },
    ];
  },
};

export default nextConfig;
