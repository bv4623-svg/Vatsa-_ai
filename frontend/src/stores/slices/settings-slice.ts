// Settings state slice
import type { AppSettings } from "@/types";
import type { StateCreator } from "zustand";

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  accentColor: "#6366f1",
  language: "en",
  fontSize: "medium",
  toastDuration: 4000,
};

export interface SettingsSlice {
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
  resetSettings: () => void;
  toggleTheme: () => void;
  setTheme: (theme: AppSettings["theme"]) => void;
  setAccentColor: (color: AppSettings["accentColor"]) => void;
  setLanguage: (lang: AppSettings["language"]) => void;
  setFontSize: (size: AppSettings["fontSize"]) => void;
}

export const createSettingsSlice: StateCreator<SettingsSlice, [], [], SettingsSlice> = (set, get) => ({
  settings: DEFAULT_SETTINGS,

  updateSettings: (newSettings) => {
    set((s) => ({ settings: { ...s.settings, ...newSettings } }));
    const { theme, accentColor, fontSize } = get().settings;
    if (typeof window !== "undefined") {
      const resolved = theme === "system"
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : theme;
      document.documentElement.classList.toggle("dark", resolved === "dark");
      if (accentColor) document.documentElement.style.setProperty("--accent-color", accentColor);
      const sizeMap = { small: "14px", medium: "16px", large: "18px", xlarge: "20px" };
      document.documentElement.style.fontSize =
        typeof fontSize === "number" ? `${fontSize}px` : sizeMap[fontSize as string] || "16px";
    }
  },

  resetSettings: () => set({ settings: DEFAULT_SETTINGS }),

  toggleTheme: () => {
    const current = get().settings.theme;
    const cycle: Record<string, string> = { light: "dark", dark: "system", system: "light" };
    get().updateSettings({ theme: cycle[current] as AppSettings["theme"] });
  },

  setTheme: (theme) => get().updateSettings({ theme }),
  setAccentColor: (color) => get().updateSettings({ accentColor: color }),
  setLanguage: (lang) => get().updateSettings({ language: lang }),
  setFontSize: (size) => get().updateSettings({ fontSize: size }),
});
