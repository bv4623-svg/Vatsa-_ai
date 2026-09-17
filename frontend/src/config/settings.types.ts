/** Every user-facing setting: its key, type, default and validation.
 * The settings UI is generated from this, so a control cannot exist
 * without a real persisted value behind it. */

export type ThemePreference = "light" | "dark" | "system";
export type ResponseStyle = "default" | "concise" | "detailed" | "friendly" | "formal";
export type HistoryRetention = "30d" | "90d" | "forever";

export interface UserSettings {
  theme: ThemePreference;
  language: string;
  timezone: string;
  defaultModel: string;
  responseStyle: ResponseStyle;
  autoSaveChats: boolean;
  historyRetention: HistoryRetention;
  notifyEmail: boolean;
  notifyInApp: boolean;
  notifyQuotaWarnings: boolean;
  notifyProductUpdates: boolean;
}

export type SettingKey = keyof UserSettings;

export interface SettingSpec<K extends SettingKey = SettingKey> {
  key: K;
  /** i18n key for the label, resolved by the settings UI. */
  labelKey: string;
  descriptionKey?: string;
  kind: "toggle" | "select" | "timezone" | "language";
  /** Only for kind === "select". Values are validated against this. */
  options?: readonly { value: string; labelKey: string }[];
  default: UserSettings[K];
  /** Settings the user must be on a paid plan to change. */
  proOnly?: boolean;
}
