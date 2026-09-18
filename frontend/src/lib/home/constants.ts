import { API_BASE } from "@/config/api";
export { API_BASE };

export const isMac =
  typeof navigator !== "undefined" ? navigator.platform.toUpperCase().indexOf("MAC") >= 0 : false;
export const MOD_KEY = isMac ? "⌘" : "Ctrl";
