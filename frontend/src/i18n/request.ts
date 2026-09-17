import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isSupportedLocale, resolveAcceptLanguage } from "./locales";

/** This app has no [locale] URL segment (see proxy.ts's flat route list --
 * restructuring 25+ existing routes under a locale prefix was judged too
 * invasive for this step), so requestLocale is always undefined here.
 * Server-side initial locale is resolved from, in order: the vatsa_locale
 * cookie (set by proxy.ts from a ?lang= param, or by the client's
 * LocaleProvider when the user picks a language) -> Accept-Language ->
 * "en". A signed-in user's profile language is then applied client-side
 * after auth hydration (see providers/LocaleProvider.tsx), since profile
 * data isn't available to this server-only config without an extra
 * network round trip per request. */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;

  let locale = DEFAULT_LOCALE;
  if (isSupportedLocale(cookieLocale)) {
    locale = cookieLocale;
  } else {
    const headerStore = await headers();
    locale = resolveAcceptLanguage(headerStore.get("accept-language")) || DEFAULT_LOCALE;
  }

  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
