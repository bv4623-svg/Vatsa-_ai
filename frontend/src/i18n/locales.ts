/** Central registry of every supported UI language. Edge-safe (no Node
 * APIs) so it can be imported from proxy.ts as well as server/client
 * components. */
export interface LocaleInfo {
  code: string;
  englishName: string;
  nativeName: string;
  dir: "ltr" | "rtl";
}

export const SUPPORTED_LOCALES: LocaleInfo[] = [
  { code: "en", englishName: "English", nativeName: "English", dir: "ltr" },
  { code: "hi", englishName: "Hindi", nativeName: "हिन्दी", dir: "ltr" },
  { code: "es", englishName: "Spanish", nativeName: "Español", dir: "ltr" },
  { code: "fr", englishName: "French", nativeName: "Français", dir: "ltr" },
  { code: "de", englishName: "German", nativeName: "Deutsch", dir: "ltr" },
  { code: "pt", englishName: "Portuguese", nativeName: "Português", dir: "ltr" },
  { code: "ar", englishName: "Arabic", nativeName: "العربية", dir: "rtl" },
  { code: "ja", englishName: "Japanese", nativeName: "日本語", dir: "ltr" },
  { code: "ko", englishName: "Korean", nativeName: "한국어", dir: "ltr" },
  { code: "zh", englishName: "Chinese (Simplified)", nativeName: "简体中文", dir: "ltr" },
  { code: "ru", englishName: "Russian", nativeName: "Русский", dir: "ltr" },
  { code: "id", englishName: "Indonesian", nativeName: "Bahasa Indonesia", dir: "ltr" },
];

export const DEFAULT_LOCALE = "en";
export const LOCALE_COOKIE = "vatsa_locale";
export const SUPPORTED_LOCALE_CODES = SUPPORTED_LOCALES.map((l) => l.code);

export function isSupportedLocale(code: string | null | undefined): code is string {
  return !!code && SUPPORTED_LOCALE_CODES.includes(code);
}

export function localeDir(code: string): "ltr" | "rtl" {
  return SUPPORTED_LOCALES.find((l) => l.code === code)?.dir ?? "ltr";
}

/** Picks the first supported locale from an Accept-Language header, e.g.
 * "fr-CA,fr;q=0.9,en;q=0.8" -> "fr". Never throws on a malformed header. */
export function resolveAcceptLanguage(header: string | null | undefined): string | null {
  if (!header) return null;
  const parts = header.split(",").map((p) => p.split(";")[0].trim().toLowerCase());
  for (const part of parts) {
    const base = part.split("-")[0];
    if (isSupportedLocale(base)) return base;
  }
  return null;
}
