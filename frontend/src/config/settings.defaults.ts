import type { SettingSpec, UserSettings } from "./settings.types";

export const THEME_OPTIONS = [
  { value: "light", labelKey: "settings.theme.light" },
  { value: "dark", labelKey: "settings.theme.dark" },
  { value: "system", labelKey: "settings.theme.system" },
] as const;

export const RESPONSE_STYLE_OPTIONS = [
  { value: "default", labelKey: "settings.responseStyle.default" },
  { value: "concise", labelKey: "settings.responseStyle.concise" },
  { value: "detailed", labelKey: "settings.responseStyle.detailed" },
  { value: "friendly", labelKey: "settings.responseStyle.friendly" },
  { value: "formal", labelKey: "settings.responseStyle.formal" },
] as const;

export const RETENTION_OPTIONS = [
  { value: "30d", labelKey: "settings.retention.30d" },
  { value: "90d", labelKey: "settings.retention.90d" },
  { value: "forever", labelKey: "settings.retention.forever" },
] as const;

export const SETTING_SPECS: SettingSpec[] = [
  { key: "theme", labelKey: "settings.theme.label", descriptionKey: "settings.theme.description", kind: "select", options: THEME_OPTIONS, default: "system" },
  { key: "language", labelKey: "settings.language.label", descriptionKey: "settings.language.description", kind: "language", default: "en" },
  { key: "timezone", labelKey: "settings.timezone.label", descriptionKey: "settings.timezone.description", kind: "timezone", default: "UTC" },
  { key: "responseStyle", labelKey: "settings.responseStyle.label", descriptionKey: "settings.responseStyle.description", kind: "select", options: RESPONSE_STYLE_OPTIONS, default: "default" },
  { key: "autoSaveChats", labelKey: "settings.autoSave.label", descriptionKey: "settings.autoSave.description", kind: "toggle", default: true },
  { key: "historyRetention", labelKey: "settings.retention.label", descriptionKey: "settings.retention.description", kind: "select", options: RETENTION_OPTIONS, default: "forever" },
  { key: "notifyEmail", labelKey: "settings.notify.email", kind: "toggle", default: true },
  { key: "notifyInApp", labelKey: "settings.notify.inApp", kind: "toggle", default: true },
  { key: "notifyQuotaWarnings", labelKey: "settings.notify.quota", kind: "toggle", default: true },
  { key: "notifyProductUpdates", labelKey: "settings.notify.product", kind: "toggle", default: false },
];

export const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  language: "en",
  timezone: "UTC",
  defaultModel: "auto",
  responseStyle: "default",
  autoSaveChats: true,
  historyRetention: "forever",
  notifyEmail: true,
  notifyInApp: true,
  notifyQuotaWarnings: true,
  notifyProductUpdates: false,
};
