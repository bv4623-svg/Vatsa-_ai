"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Search } from "lucide-react";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
import { useLocaleSwitcher } from "@/providers/LocaleProvider";

/** Logical (start/end) Tailwind utilities throughout, not left/right, so
 * this mirrors correctly under dir="rtl" (Arabic) without a separate
 * RTL-specific stylesheet. */
export function LanguageSelect() {
  const t = useTranslations("settings.language");
  const { locale, setLocale } = useLocaleSwitcher();
  const [query, setQuery] = useState("");

  const filtered = SUPPORTED_LOCALES.filter((l) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return l.englishName.toLowerCase().includes(q) || l.nativeName.toLowerCase().includes(q) || l.code.includes(q);
  });

  return (
    <div className="max-w-sm">
      <label htmlFor="language-search" className="mb-1 block text-sm font-medium text-foreground">{t("label")}</label>
      <p className="mb-2 text-xs text-muted-foreground">{t("description")}</p>

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          id="language-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-lg border border-border bg-input/10 py-2 ps-9 pe-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none"
        />
      </div>

      <div role="listbox" aria-label={t("label")} className="max-h-64 overflow-y-auto rounded-lg border border-border">
        {filtered.length === 0 && <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t("noResults")}</p>}
        {filtered.map((l) => (
          <button
            key={l.code}
            role="option"
            aria-selected={l.code === locale}
            onClick={() => void setLocale(l.code)}
            className="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-accent/10"
          >
            <span>
              <span className="text-foreground">{l.nativeName}</span>
              {l.nativeName !== l.englishName && <span className="ms-1.5 text-xs text-muted-foreground">({l.englishName})</span>}
            </span>
            {l.code === locale && <Check className="h-4 w-4 text-accent" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  );
}
