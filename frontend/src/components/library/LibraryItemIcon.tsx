import { Code2, FileText, Folder, Image as ImageIcon, MessageSquare, Sparkles, Upload } from "lucide-react";
import type { LibraryItemType } from "@/types/library";

const ICONS: Record<LibraryItemType, React.ComponentType<{ className?: string }>> = {
  folder: Folder,
  chat: MessageSquare,
  document: FileText,
  code: Code2,
  artifact: Sparkles,
  upload: Upload,
  generated: ImageIcon,
};

export function LibraryItemIcon({ type, isFolder, className }: { type: LibraryItemType; isFolder: boolean; className?: string }) {
  const Icon = isFolder ? Folder : (ICONS[type] ?? FileText);
  return <Icon className={className} aria-hidden="true" />;
}
