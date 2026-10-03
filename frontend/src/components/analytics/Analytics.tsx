"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { GoogleAnalytics } from "@next/third-parties/google";
import { GA_MEASUREMENT_ID, analyticsAllowedHere } from "@/lib/analytics/config";
import { consentSnapshot, parseConsent, subscribeConsent } from "@/lib/analytics/consent";

/** Pages whose URL carries a secret or personal data. GA records the full
 * page URL, so it must never run there: /auth/callback?token=...&email=...
 * would hand Google a live sign-in token, and /share/<token> is a link that
 * opens someone's conversation. An event fired on one of these pages (the
 * sign-in callback's login/sign_up) waits until the next page loads GA. */
const NO_ANALYTICS_PREFIXES = ["/auth/callback", "/share/"];

/** Removes GA's own cookies (_ga, _ga_<id>) after consent is withdrawn. GA
 * sets them on the registrable domain, so both that and the host are tried. */
function clearGaCookies() {
  const names = document.cookie
    .split(";")
    .map((c) => c.split("=")[0].trim())
    .filter((n) => n === "_ga" || n.startsWith("_ga_"));
  const host = window.location.hostname;
  const domains = [host, `.${host.replace(/^www\./, "")}`];
  for (const name of names) {
    document.cookie = `${name}=; Max-Age=0; Path=/`;
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${domain}`;
  }
}

/** Loads GA4 only after the visitor accepts analytics cookies, only on the
 * live site, and never on the pages above. GA's documented kill switch
 * (window["ga-disable-<id>"]) silences an already-loaded tag when consent is
 * withdrawn or the visitor moves onto one of those pages. */
export function Analytics() {
  const pathname = usePathname() || "";
  // null on the server and during hydration; the stored string afterwards.
  const raw = useSyncExternalStore(subscribeConsent, consentSnapshot, () => null);
  const allowed = raw !== null && analyticsAllowedHere();
  const granted = raw !== null && parseConsent(raw)?.analytics === true;
  const sensitivePage = NO_ANALYTICS_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!allowed) return;
    (window as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`] = !granted || sensitivePage;
    if (!granted) clearGaCookies();
  }, [allowed, granted, sensitivePage]);

  return allowed && granted && !sensitivePage ? <GoogleAnalytics gaId={GA_MEASUREMENT_ID} /> : null;
}
