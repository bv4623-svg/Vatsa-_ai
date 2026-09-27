export type ThemeMode = "dark" | "light" | "system";
export type AccentColor = "default" | "blue" | "purple" | "green" | "orange";
export type FontSize = "small" | "medium" | "large";

export type AttachmentStatus = "processing" | "ready" | "error";

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  isBase64: boolean;
  status: AttachmentStatus;
  preview?: string;
  /** Why the file could not be attached (shown on the chip). */
  error?: string;
  /** Attached, but with a caveat, e.g. the document was truncated. */
  warning?: string;
}
