import { DEFAULT_SETTINGS, SETTING_SPECS } from "./settings.defaults";
import type { SettingKey, UserSettings } from "./settings.types";

/** Narrows an arbitrary stored value to a valid setting, falling back to the
 * default. Stops a stale cookie or an edited profile row from putting the UI
 * into a state no control can represent. */
export function coerceSetting<K extends SettingKey>(key: K, value: unknown): UserSettings[K] {
  const spec = SETTING_SPECS.find((s) => s.key === key);
  const fallback = DEFAULT_SETTINGS[key];

  if (!spec) return fallback;

  if (spec.kind === "toggle") {
    return (typeof value === "boolean" ? value : fallback) as UserSettings[K];
  }

  if (spec.options) {
    const allowed = spec.options.some((o) => o.value === value);
    return (allowed ? value : fallback) as UserSettings[K];
  }

  return (typeof value === "string" && value.trim() ? value : fallback) as UserSettings[K];
}

/** Validates a whole settings object coming from the API or storage. */
export function coerceSettings(raw: Partial<Record<string, unknown>> | null | undefined): UserSettings {
  const next = { ...DEFAULT_SETTINGS };
  if (!raw) return next;

  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
    if (key in raw) {
      // Assigning through a generic index needs the cast; coerceSetting has
      // already guaranteed the value matches this key's type.
      (next[key] as UserSettings[typeof key]) = coerceSetting(key, raw[key]);
    }
  }
  return next;
}

export function resolveTimezone(stored: string | undefined): string {
  if (stored && stored !== "UTC") return stored;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
