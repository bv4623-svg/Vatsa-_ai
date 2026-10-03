/** GA4 measurement ID. Public by design: every page that loads GA shows it. */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || "G-NCHLX6K63L";

/** Only the live site reports to GA, so local runs and preview builds don't
 * mix test traffic into real numbers. A test build can set
 * NEXT_PUBLIC_GA_ANY_HOST=1 to load it anywhere. */
const ANALYTICS_HOSTS = ["vatsaai.com", "www.vatsaai.com"];

export function analyticsAllowedHere(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_GA_ANY_HOST === "1") return true;
  return ANALYTICS_HOSTS.includes(window.location.hostname);
}
