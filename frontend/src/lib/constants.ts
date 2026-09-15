import type { Settings, Workspace } from "../types/chat";

export const STORAGE_KEYS = {
  workspace: "vatsa_workspace",
  theme: "vatsa_theme",
  chats: "vatsa_chats",
  sidebar: "vatsa_sidebar",
  settings: "vatsa_settings",
} as const;

export const MODELS = [
  {
    id: "vatsa-1.5-pro",
    name: "Vatsa 1.5 Pro",
    desc: "Deepest reasoning for complex work",
    badge: "Pro",
  },
  {
    id: "vatsa-1.5-flash",
    name: "Vatsa 1.5 Flash",
    desc: "Fast responses for everyday tasks",
    badge: "Fast",
  },
  {
    id: "vatsa-mini",
    name: "Vatsa Mini",
    desc: "Lightweight and efficient",
    badge: "Lite",
  },
  {
    id: "vatsa-research",
    name: "Vatsa Research",
    desc: "Long-context analysis and citations",
    badge: "Beta",
  },
] as const;

export const ACCENTS = [
  { id: "zinc", label: "Mono", value: "#f5f5f5" },
  { id: "violet", label: "Violet", value: "#8b5cf6" },
  { id: "blue", label: "Blue", value: "#3b82f6" },
  { id: "emerald", label: "Emerald", value: "#10b981" },
  { id: "amber", label: "Amber", value: "#f59e0b" },
  { id: "rose", label: "Rose", value: "#f43f5e" },
];

export const LANGUAGES = [
  "English",
  "हिन्दी",
  "Español",
  "Français",
  "Deutsch",
  "日本語",
  "中文",
  "العربية",
];

export const VOICES = ["Aria", "Nova", "Onyx", "Sage", "Vega"];

export const DEFAULT_SETTINGS: Settings = {
  language: "English",
  autoTitle: true,
  sendOnEnter: true,
  theme: "dark",
  accent: "zinc",
  compactMode: false,
  fontSize: 16,
  showTimestamps: true,
  reduceMotion: false,
  streaming: true,
  streamSpeed: 2,
  suggestions: true,
  memoryEnabled: true,
  memories: [],
  defaultModel: "vatsa-1.5-pro",
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: "",
  voiceEnabled: true,
  voiceName: "Aria",
  autoSpeak: false,
  notifySound: false,
  notifyDesktop: false,
  saveHistory: true,
  trainingOptIn: false,
  displayName: "You",
  email: "",
  plan: "Free",
};

export const DEFAULT_WORKSPACE: Workspace = {
  version: 1,
  activeChatId: null,
  sidebarCollapsed: false,
  sidebarWidth: 280,
  settings: DEFAULT_SETTINGS,
  conversations: [],
  folders: [],
  recentSearches: [],
};

export const SIDEBAR_MIN = 232;
export const SIDEBAR_MAX = 420;
