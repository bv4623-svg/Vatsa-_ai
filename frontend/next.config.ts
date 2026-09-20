import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/:path*`,
      },
    ];
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
