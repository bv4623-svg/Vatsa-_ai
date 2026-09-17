"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { THEME_OPTIONS, type ThemePreference } from "@/config/settings";
import { saveSettings } from "@/lib/settings-client";

const ICONS: Record<ThemePreference, React.ReactNode> = {
  light: <Sun className="h-4 w-4" aria-hidden="true" />,
  dark: <Moon className="h-4 w-4" aria-hidden="true" />,
  system: <Monitor className="h-4 w-4" aria-hidden="true" />,
};

const LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "Follow system",
};

/** Applies instantly, persists to localStorage + cookie (so the server can
 * render the right theme with no flash), and is mirrored to the user's
 * profile by the caller so it follows them across devices. */
export function ThemeSwitcher({ onChange }: { onChange?: (next: ThemePreference) => void }) {
  const { preference, setTheme } = useTheme();

  const select = (next: ThemePreference) => {
    setTheme(next);
    onChange?.(next);
    // Fire-and-forget: the cookie already applied it locally, this just
    // makes the choice follow the user to their other devices.
    void saveSettings({ theme: next });
  };

  return (
    <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-2">
      {THEME_OPTIONS.map((option) => {
        const value = option.value as ThemePreference;
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => select(value)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              active
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-accent/5 hover:text-foreground"
            )}
          >
            {ICONS[value]}
            {LABELS[value]}
          </button>
        );
      })}
    </div>
  );
}
