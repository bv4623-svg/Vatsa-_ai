// Settings modal — shared data constants
export const ACCENTS = [
  { id: "blue", value: "#3b82f6", label: "Blue" },
  { id: "purple", value: "#8b5cf6", label: "Purple" },
  { id: "green", value: "#10b981", label: "Green" },
  { id: "orange", value: "#f97316", label: "Orange" },
  { id: "red", value: "#ef4444", label: "Red" },
  { id: "pink", value: "#ec4899", label: "Pink" },
  { id: "teal", value: "#14b8a6", label: "Teal" },
];

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
];

export const MODELS: Array<{ id: string; name: string; desc: string; badge: string }> = [];

export const VOICES = ["Amy", "Brian", "Emma", "James", "Sofia"];

export const LEGAL_LINKS = [
  { label: "About Vatsa AI", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Cookie Policy", href: "/cookies" },
  { label: "Security", href: "/security" },
  { label: "Disclaimer", href: "/disclaimer" },
  { label: "Refund Policy", href: "/refund" },
  { label: "Return Policy", href: "/return" },
];

export const SHORTCUTS: [string, string][] = [
  ["New chat", "Ctrl / ⌘ + K"],
  ["Search chats", "Ctrl / ⌘ + /"],
  ["Open settings", "Ctrl / ⌘ + ,"],
  ["Toggle sidebar", "Ctrl / ⌘ + B"],
  ["Send message", "Enter"],
  ["New line", "Shift + Enter"],
];

export type SettingsSection =
  | "general" | "appearance" | "language" | "chat" | "memory"
  | "history" | "models" | "voice" | "notifications" | "account"
  | "billing" | "privacy" | "keyboard" | "about" | "legal";
