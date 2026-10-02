import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";

// Public pages only. Signed-in pages (PROTECTED_PREFIXES in
// lib/proxy/routes.ts) send visitors to /login, and /share/* links are
// people's own conversations, so neither belongs in a sitemap.
const PUBLIC_PATHS = [
  "/",
  "/pricing",
  "/about",
  "/contact",
  "/security",
  "/privacy",
  "/terms",
  "/refund",
  "/cookies",
  "/disclaimer",
  "/login",
  "/signup",
];

// Built once per deploy (no request data is read), so lastModified is the
// deploy date.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PATHS.map((path) => ({ url: new URL(path, SITE_URL).toString(), lastModified }));
}
