"use client";

import { openCookieSettings } from "@/lib/analytics/consent";

/** Reopens the cookie settings dialog (CookieBanner listens for it). */
export function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className="mt-4 min-h-[44px] rounded-lg bg-blue-600 px-5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      Cookie settings
    </button>
  );
}
