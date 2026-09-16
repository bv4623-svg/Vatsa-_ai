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
}
