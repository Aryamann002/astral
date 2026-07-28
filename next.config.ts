import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy.
 *
 * `script-src` carries 'unsafe-inline' as a deliberate trade rather than an
 * oversight. Every page in this app is statically prerendered, and Next.js
 * embeds the RSC payload as inline <script> tags inside that prerendered HTML
 * — six per page. A nonce cannot cover them: nonces are minted per request, so
 * adopting one forces all nine pages to dynamic rendering, surrendering CDN
 * caching and the static shell for an app that is client-rendered anyway and
 * has nothing else to gain from a server round trip.
 *
 * The defensive value therefore sits in the rest of the policy. `script-src
 * 'self'` still refuses attacker-hosted script origins, `connect-src 'self'`
 * refuses exfiltration to a third party, and object-src / base-uri /
 * form-action / frame-ancestors close the usual injection and clickjacking
 * routes. This codebase has no HTML-injection sink at all — no
 * dangerouslySetInnerHTML, no innerHTML, no eval — so React's escaping is the
 * primary XSS defence and this policy is the backstop behind it.
 *
 * Development needs two extra allowances: React uses eval() to reconstruct
 * server-side stacks in the browser, and HMR talks over a websocket.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // React and Tailwind both emit inline style attributes, which style-src
  // governs. Far lower risk than the script-src equivalent.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  // next/font downloads Bodoni Moda and Manrope at build time and serves them
  // from /_next/static, so no Google origin is needed here.
  "font-src 'self'",
  // The browser only ever calls this app's own /api routes.
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  // Pointless over plain-http localhost, and it breaks the dev server.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

/**
 * Every browser feature this app does not use, switched off. Note geolocation:
 * birthplace is resolved through the place search, so the app never has cause
 * to ask the device where it is.
 */
const permissionsPolicy = [
  "accelerometer=()",
  "autoplay=()",
  "browsing-topics=()",
  "camera=()",
  "display-capture=()",
  "encrypted-media=()",
  "fullscreen=()",
  "geolocation=()",
  "gyroscope=()",
  "idle-detection=()",
  "local-fonts=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "picture-in-picture=()",
  "publickey-credentials-get=()",
  "screen-wake-lock=()",
  "serial=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Two years, subdomains included. Worth knowing before pointing a custom
  // domain here: it commits every subdomain to HTTPS for that long.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Superseded by frame-ancestors above, kept for browsers that predate it.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: permissionsPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

const nextConfig: NextConfig = {
  // Drops `X-Powered-By: Next.js`, which advertises the framework to anyone
  // shopping for a matching CVE.
  poweredByHeader: false,

  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        // Cache-Control is set per-route instead of here, since /api/geocode
        // is cacheable and the other two are emphatically not.
        source: "/api/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
