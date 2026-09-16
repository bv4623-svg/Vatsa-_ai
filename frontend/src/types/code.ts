export interface ProjectFile {
  name: string;
  content: string;
  language?: string;
}

export interface UserProfile {
  full_name?: string;
  email?: string;
}

export type ThemeMode = "dark" | "light" | "system";
export type AccentColor = "default" | "blue" | "purple" | "green" | "orange";
export type PreviewMode = "preview" | "code";
export type Device = "desktop" | "tablet" | "mobile";

export const MODELS = [
  { id: "auto", label: "Vatsa AI (recommended)" },
  { id: "vatsa-pro", label: "Vatsa AI Pro" },
  { id: "vatsa-advanced", label: "Vatsa AI Advanced" },
  { id: "vatsa-fast", label: "Vatsa AI Fast" },
] as const;
