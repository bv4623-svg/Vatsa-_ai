export type Role = "user" | "assistant" | "system";

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  edited: boolean;
  status: "sending" | "streaming" | "done" | "error" | "stopped";
  attachments: Attachment[];
  bookmarked: boolean;
  model?: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  lastOpened: number;
  pinned: boolean;
  archived: boolean;
  favorite: boolean;
  folderId?: string | null;
  model: string;
  temperature: number;
  systemPrompt?: string;
  draft: string;
  scrollPosition: number;
  deletedAt?: number | null;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export type ThemeMode = "dark" | "light" | "system";

export interface Settings {
  // General
  language: string;
  autoTitle: boolean;
  sendOnEnter: boolean;
  // Appearance
  theme: ThemeMode;
  accent: string;
  compactMode: boolean;
  fontSize: number;
  showTimestamps: boolean;
  reduceMotion: boolean;
  // Chat
  streaming: boolean;
  streamSpeed: number;
  suggestions: boolean;
  // Memory
  memoryEnabled: boolean;
  memories: { id: string; text: string; createdAt: number }[];
  // Models
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  // Voice
  voiceEnabled: boolean;
  voiceName: string;
  autoSpeak: boolean;
  // Notifications
  notifySound: boolean;
  notifyDesktop: boolean;
  // Privacy
  saveHistory: boolean;
  trainingOptIn: boolean;
  // Account
  displayName: string;
  email: string;
  plan: string;
}

export interface Workspace {
  version: number;
  activeChatId: string | null;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  settings: Settings;
  conversations: Chat[];
  folders: Folder[];
  recentSearches: string[];
}
