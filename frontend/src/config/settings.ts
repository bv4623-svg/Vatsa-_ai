/**
 * Single source of truth for user settings: keys, types, defaults and
 * validation. The settings UI renders from SETTING_SPECS, so a control
 * cannot appear without a real persisted value behind it.
 */
export * from "./settings.types";
export * from "./settings.defaults";
export * from "./settings.utils";
