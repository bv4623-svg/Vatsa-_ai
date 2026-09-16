export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const isMac =
  typeof navigator !== "undefined" ? navigator.platform.toUpperCase().indexOf("MAC") >= 0 : false;
export const MOD_KEY = isMac ? "⌘" : "Ctrl";
