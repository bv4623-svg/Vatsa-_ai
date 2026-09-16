"use client";

import { memo } from "react";
import { Paperclip, FolderOpen } from "lucide-react";

export const AttachmentMenu = memo(({ open, onClose, onFileUpload, onFolderUpload }: any) => {
  if (!open) return null;
  return (
    <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-border bg-background p-1.5 shadow-2xl z-50" onMouseLeave={onClose}>
      <button onClick={onFileUpload} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent/10 text-sm text-foreground/80">
        <Paperclip className="w-4 h-4 text-muted-foreground" /> Upload File
      </button>
      <button onClick={onFolderUpload} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent/10 text-sm text-foreground/80">
        <FolderOpen className="w-4 h-4 text-muted-foreground" /> Upload Folder
      </button>
    </div>
  );
});
AttachmentMenu.displayName = "AttachmentMenu";
