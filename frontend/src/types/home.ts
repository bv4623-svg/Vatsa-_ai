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
  /** Upload progress, 0-100, while status is "processing". */
  progress?: number;
  /** Set once POST /api/upload completes -- the file is persisted (Library
   * row, counts toward storage quota, survives a refresh) at this point,
   * not just held in browser memory. */
  fileId?: string;
  url?: string;
  thumbnailUrl?: string;
}
