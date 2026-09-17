"use client";

import { LanguageSelect } from "@/components/settings/LanguageSelect";

/** Replaces the old hardcoded 26-language <select> that only wrote to a
 * local-only zustand slice ("saved for future localization") with the
 * real, working i18n switcher built in the localization step. */
export function LanguageTab() {
  return <LanguageSelect />;
}
