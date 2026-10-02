const path = require("path");
const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Same resolution as src/config/api.ts: the deployed API origin, defaulting
// to the live API.
const backendOrigin = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "https://vatsa-ai.onrender.com"
).replace(/\/+$/, "");

// No Content-Security-Policy on purpose: Razorpay's checkout script, iframe
// and analytics endpoints make a strict policy easy to get subtly wrong,
// and a broken checkout costs more than the policy would protect.
const securityHeaders = [
  // One year, no "preload": preloading commits every subdomain to HTTPS
  // permanently, which is the owner's call once every subdomain is ready.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Microphone stays allowed for our own pages: voice dictation
  // (src/lib/voice/stt.ts) needs it. Nothing here uses the camera or location.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't advertise the framework (X-Powered-By: Next.js).
  poweredByHeader: false,

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/:path*`,
      },
    ];
  },

  // Crawlers guess /about-us; the page lives at /about. permanent: true
  // sends a 308, which search engines treat like a 301.
  async redirects() {
    return [{ source: "/about-us", destination: "/about", permanent: true }];
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  // Explicit fallback for the "@/*" -> "src/*" alias (tsconfig.json already
  // declares it under compilerOptions.paths, and Next.js normally infers
  // this into the webpack config automatically) -- added because Hostinger's
  // build environment failed to resolve "@/..." imports with
  // "Module not found" even though the target files exist, tsconfig.json is
  // present and correct, and the same build succeeds locally. Harmless
  // where automatic inference already works; only makes a difference where
  // it silently doesn't.
  webpack(config) {
    config.resolve.alias["@"] = path.resolve(__dirname, "src");
    return config;
  },
};

module.exports = withNextIntl(nextConfig);
