"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { LOCALE_COOKIE, isSupportedLocale, localeDir } from "@/i18n/locales";
import { API_BASE } from "@/config/api";

interface LocaleContextValue {
  locale: string;
  dir: "ltr" | "rtl";
  setLocale: (code: string) => Promise<void>;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function persistLocaleCookie(code: string) {
  document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

interface LocaleProviderProps {
  initialLocale: string;
  initialMessages: AbstractIntlMessages;
  children: ReactNode;
}

/** Client-side locale state, seeded from the server-resolved locale (see
 * i18n/request.ts) but switchable instantly afterwards without a full
 * reload -- Settings' language picker calls setLocale(), which swaps in
 * a dynamically-imported message catalog, updates <html lang/dir>, and
 * persists the choice to both the cookie and (if signed in) the user's
 * profile via the existing PATCH /auth/settings. */
export function LocaleProvider({ initialLocale, initialMessages, children }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState(initialLocale);
  const [messages, setMessages] = useState(initialMessages);

  const setLocale = useCallback(async (code: string) => {
    if (!isSupportedLocale(code) || code === locale) return;
    const next = (await import(`../messages/${code}.json`)).default as AbstractIntlMessages;
    setLocaleState(code);
    setMessages(next);
    persistLocaleCookie(code);
    document.documentElement.lang = code;
    document.documentElement.dir = localeDir(code);

    const { getToken } = await import("@/lib/auth");
    const token = getToken();
    if (token) {
      fetch(`${API_BASE}/auth/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ language: code }),
      }).catch(() => {
        // Best-effort profile sync -- the cookie above already persists
        // the choice for this browser even if this call fails.
      });
    }
  }, [locale]);

  const value = useMemo(() => ({ locale, dir: localeDir(locale), setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export function useLocaleSwitcher(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocaleSwitcher must be used within LocaleProvider");
  return ctx;
}
