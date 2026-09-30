import { API_BASE } from "@/config/api";
export { API_BASE };

export const isMac =
  typeof navigator !== "undefined" ? navigator.platform.toUpperCase().indexOf("MAC") >= 0 : false;
export const MOD_KEY = isMac ? "⌘" : "Ctrl";

/** The chat box grows with its text up to 4 lines (24px each) plus its
 * 8px top/bottom padding, then scrolls. Used by both composers and the
 * /home input handler that sets the height. */
export const COMPOSER_MAX_HEIGHT_PX = 4 * 24 + 16;
