"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@/stores/auth";
import { useLocaleSwitcher } from "@/providers/LocaleProvider";
import { isSupportedLocale } from "@/i18n/locales";

/** Applies a signed-in user's saved language preference once, right after
 * auth hydrates -- completing the "URL > profile > Accept-Language"
 * priority order (the cookie/header half is already resolved server-side
 * by i18n/request.ts). A ?lang= param always wins regardless, because
 * proxy.ts writes it to the cookie before this ever runs, so the initial
 * server-rendered locale already reflects it. setLocale() is async and
 * only touches state after its dynamic import resolves, so calling it
 * here doesn't set state synchronously within this effect. */
export function useSyncProfileLocale() {
  const user = useUser();
  const { locale, setLocale } = useLocaleSwitcher();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current || !user) return;
    applied.current = true;
    const profileLocale = user.settings?.language;
    if (isSupportedLocale(profileLocale) && profileLocale !== locale) {
      void setLocale(profileLocale);
    }
  }, [user, locale, setLocale]);
}
