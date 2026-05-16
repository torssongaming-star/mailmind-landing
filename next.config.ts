import type { NextConfig } from "next";

/**
 * Security headers — applied via Next's headers() API.
 *
 * Routes:
 *   /addins/*  → must be embeddable in Outlook iframes (CSP frame-ancestors)
 *   everything else → DENY framing + standard hardening
 */

const SHARED_SECURITY_HEADERS = [
  // Prevent MIME sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Reduce information leak in referers
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down browser APIs we never use — defence in depth against XSS
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  },
  // Force HTTPS for a year; preload-eligible
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
];

const OUTLOOK_FRAME_CSP =
  "frame-ancestors 'self' https://*.outlook.com https://*.office.com https://*.office365.com https://outlook.office.com https://outlook.office365.com https://outlook.live.com https://*.msappproxy.net https://*.microsoft.com;";

const DENY_FRAME_CSP = "frame-ancestors 'self';";

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Outlook add-in routes — allow embedding in Outlook frames
      {
        source: "/addins/:path*",
        headers: [
          { key: "Content-Security-Policy", value: OUTLOOK_FRAME_CSP },
          ...SHARED_SECURITY_HEADERS,
        ],
      },
      // Everything else — deny framing
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: DENY_FRAME_CSP },
          { key: "X-Frame-Options", value: "DENY" },
          ...SHARED_SECURITY_HEADERS,
        ],
      },
    ];
  },
};

export default nextConfig;
