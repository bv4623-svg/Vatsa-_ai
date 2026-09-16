import { useState, useCallback, useEffect } from "react";
import type { ThemeMode, AccentColor, FontSize } from "@/types/home";

/** Theme, accent color, font size, and interface language for the Chat page, persisted to localStorage. */
export function useHomeTheme() {
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [accentColor, setAccentColor] = useState<AccentColor>("default");
  const [fontSize, setFontSize] = useState<FontSize>("medium");

  const setLanguage = useCallback((lang: string) => {
    localStorage.setItem("vatsa-language", lang);
  }, []);

  const handleThemeChange = useCallback((newTheme: ThemeMode) => {
    setTheme(newTheme);
    localStorage.setItem("vatsa-theme", newTheme);
    if (newTheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    } else {
      document.documentElement.classList.toggle("dark", newTheme === "dark");
    }
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("vatsa-theme") as ThemeMode | null;
    if (savedTheme) handleThemeChange(savedTheme);
    const savedLang = localStorage.getItem("vatsa-language");
    if (savedLang) setLanguage(savedLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => document.documentElement.classList.toggle("dark", media.matches);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, [theme]);

  const accentColorHex = (() => {
    switch (accentColor) {
      case "blue": return "#3b82f6";
      case "purple": return "#a855f7";
      case "green": return "#10b981";
      case "orange": return "#f97316";
      default: return "#a855f7";
    }
  })();

  const fontSizePx = (() => {
    switch (fontSize) {
      case "small": return "14px";
      case "large": return "18px";
      default: return "16px";
    }
  })();

  return {
    theme, handleThemeChange,
    accentColor, setAccentColor, accentColorHex,
    fontSize, setFontSize, fontSizePx,
    setLanguage,
  };
}
