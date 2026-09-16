import { useState, useCallback, useEffect } from "react";
import type { ThemeMode, AccentColor } from "@/types/code";

/** Theme + accent color, persisted to localStorage, applied to <html>. */
export function useWorkspaceTheme() {
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [accentColor, setAccentColor] = useState<AccentColor>("default");

  const handleThemeChange = useCallback((next: ThemeMode) => {
    setTheme(next);
    localStorage.setItem("vatsa-theme", next);
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = next === "dark" || (next === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("vatsa-theme") as ThemeMode | null;
    const savedAccent = localStorage.getItem("vatsa-accent") as AccentColor | null;
    if (savedTheme) handleThemeChange(savedTheme);
    if (savedAccent) setAccentColor(savedAccent);
  }, [handleThemeChange]);

  useEffect(() => {
    localStorage.setItem("vatsa-accent", accentColor);
  }, [accentColor]);

  const accentColorHex = (() => {
    switch (accentColor) {
      case "blue": return "#3b82f6";
      case "purple": return "#a855f7";
      case "green": return "#10b981";
      case "orange": return "#f97316";
      default: return "#a855f7";
    }
  })();

  return { theme, accentColor, setAccentColor, handleThemeChange, accentColorHex };
}
