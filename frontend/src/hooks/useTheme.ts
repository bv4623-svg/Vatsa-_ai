"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ThemePreference } from "@/config/settings";
import {
  applyTheme,
  persistThemePreference,
  readStoredPreference,
  type ResolvedTheme,
} from "@/lib/theme";

// Cached so getSnapshot is referentially stable, and shared so every
// mounted switcher re-renders together when the preference changes.
let current: ThemePreference | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): ThemePreference {
  if (!current) current = readStoredPreference();
  return current;
}

function getServerSnapshot(): ThemePreference {
  return "system";
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  // "system" must react to the OS flipping while the tab is open.
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (getSnapshot() === "system") {
      applyTheme("system");
      listener();
    }
  };
  media.addEventListener("change", onSystemChange);

  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystemChange);
  };
}

export function useTheme(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setTheme: (next: ThemePreference) => void;
} {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: ThemePreference) => {
    current = next;
    persistThemePreference(next);
    applyTheme(next);
    listeners.forEach((l) => l());
  }, []);

  const resolved: ResolvedTheme =
    preference === "system"
      ? typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : preference;

  return { preference, resolved, setTheme };
}
