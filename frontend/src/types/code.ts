export interface ProjectFile {
  name: string;
  content: string;
  language?: string;
}

export type ThemeMode = "dark" | "light" | "system";
export type AccentColor = "default" | "blue" | "purple" | "green" | "orange";
export type PreviewMode = "preview" | "code";
export type Device = "desktop" | "tablet" | "mobile";

export const MODELS = [
  { id: "auto", label: "Auto (recommended)" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
] as const;
