import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  async redirects() {
    return [
      // Keep old /v2 links working after the swap
      { source: "/v2", destination: "/", permanent: false },
    ];
  },
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

// Wrap with Sentry's webpack plugin so client-side errors are captured.
// Without this wrapper, sentry.client.config.ts is never loaded by Next.js
// and Issues stays empty even with a correct DSN.
//
// Source map upload requires SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT
// in Vercel env — but event capture works without those, so we keep this
// minimal. Add the token later for readable stack traces.
let configToExport = nextConfig;

// Fix for Vercel builds: if Sentry is not fully configured (missing token),
// the @sentry/nextjs plugin crashes with 'TypeError: The "path" argument must be of type string.'
// We bypass the Sentry wrapper entirely in this scenario to unblock the deploy.
if (process.env.SENTRY_AUTH_TOKEN || !process.env.VERCEL) {
  configToExport = withSentryConfig(nextConfig, {
    silent: !process.env.CI,
    disableLogger: true,
  });
}

export default configToExport;
