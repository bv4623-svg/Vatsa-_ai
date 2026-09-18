export type FocusMode = "all" | "general" | "academic" | "creative" | "technical" | "social" | "news" | "video" | "code";

export type ModelOption = string;

export type Theme = "light" | "dark" | "system";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type Plan = "free" | "pro" | "enterprise";

export type FileStatus = "uploading" | "processing" | "ready" | "error";

export type OrchestrationStepStatus = "pending" | "running" | "done" | "error";

export interface Source {
  id: string;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  favicon?: string;
  confidence: number;
  freshness?: string;
  visited?: boolean;
  // Web-search-grounded chat citations (see SourcesList) additionally
  // carry these; optional so the existing right-panel Source usage is
  // untouched.
  index?: number;
  quality?: "high" | "medium" | "low";
  published_date?: string;
}

export interface Citation {
  id: number;
  sourceId: string;
  text: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: "running" | "done" | "error";
}

export interface OrchestrationStep {
  id: string;
  icon: string;
  label: string;
  status: OrchestrationStepStatus;
  duration?: string;
  detail?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  model?: string;
  sources?: Source[];
  thinking?: string;
  citations?: Citation[];
  toolCalls?: ToolCall[];
  orchestrationSteps?: OrchestrationStep[];
  feedback?: "positive" | "negative";
  createdAt: Date | string;
  isStreaming?: boolean;
}

export interface Conversation {
  id: string | number;
  title: string;
  model?: ModelOption;
  focusMode?: FocusMode;
  webSearchEnabled?: boolean;
  pinned?: boolean;
  messages: Message[];
  createdAt: Date | string;
  updatedAt: Date | string;
  favorite?: boolean;
  archived?: boolean;
  deletedAt?: Date | string;
}

export interface UserFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  status: FileStatus;
  createdAt: Date | string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  plan: Plan;
  // Free/pro/business tier gating (see backend app/services/feature_access.py).
  tier?: "free" | "pro" | "business";
  usage?: Record<string, { used: number; limit: number }>;
}

export interface UserSettings {
  theme: Theme;
  fontSize: "sm" | "md" | "lg";
  sidebarCollapsed: boolean;
  defaultModel: ModelOption;
  defaultFocusMode: FocusMode;
  webSearchDefault: boolean;
  voiceEnabled: boolean;
}

export interface RoutingInfo {
  queryType: string;
  routedModel: string;
  reason: string;
  icon: string;
}

export interface PricingPlan {
  id: Plan;
  name: string;
  price: number;
  features: { label: string; included: boolean }[];
  cta: string;
  popular?: boolean;
}

export interface UserSubscription {
  planId: string;
  status: string;
  currentPeriodEnd?: string | number | Date;
}

export interface FeatureFlags {
  [key: string]: boolean;
}

export interface AppSettings {
  [key: string]: unknown;
  theme: Theme;
  accentColor?: string;
  fontSize: "small" | "medium" | "large" | number;
  density?: string;
  language: string;
  animations?: boolean;
  streamingSpeed?: string;
  autoSave?: boolean;
  encryption?: boolean;
  sessionManagement?: boolean;
  privacyMode?: boolean;
  clearCacheOnExit?: boolean;
  notifications?: boolean;
  notificationSound?: boolean;
  toastDuration: number;
  defaultModel?: ModelOption;
  autoRouter?: boolean;
  webSearchDefault?: boolean;
  focusModeDefault?: FocusMode;
  developerMode?: boolean;
  debugMode?: boolean;
  multiAgent?: boolean;
  aiDebate?: boolean;
  parallelResponses?: boolean;
  promptImprovement?: boolean;
  autoToolSelection?: boolean;
  codeExecutionSandbox?: boolean;
  scheduledTasks?: boolean;
  backgroundAgents?: boolean;
  customPersonas?: boolean;
  customInstructions?: boolean;
  shortcuts?: Record<string, string>;
  exportSettings?: boolean;
  importSettings?: boolean;
  autoGenerateTitles?: boolean;
  sendWithEnter?: boolean;
  showPrompts?: boolean;
  reduceMotion?: boolean;
  compactMode?: boolean;
  showTimestamps?: boolean;
  streamResponses?: boolean;
  streamSpeed?: number;
  systemPrompt?: string;
  memoryEnabled?: boolean;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface Testimonial {
  name: string;
  role: string;
  company: string;
  avatar?: string;
  quote: string;
}

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  duration?: number;
}