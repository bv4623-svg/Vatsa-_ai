"use client";

import { memo } from "react";
import { Paperclip, X, Sparkles } from "lucide-react";
import type { Attachment } from "@/types/home";

interface AttachmentChipProps {
  file: Attachment;
  onRemove: (id: string) => void;
  onAnalyze?: (file: Attachment) => void;
  analyzing?: boolean;
}

export const AttachmentChip = memo(({ file, onRemove, onAnalyze, analyzing }: AttachmentChipProps) => {
  const isImage = file.type.startsWith("image/");
  return (
    <div className="group flex items-center gap-2 rounded-lg border border-border bg-card/70 px-2 py-1.5 text-xs max-w-[220px]">
      {file.preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file.preview} alt={file.name} className="h-8 w-8 rounded object-cover" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded bg-accent/10">
          <Paperclip className="h-4 w-4 text-accent" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{file.name}</p>
        {file.status === "processing" ? (
          <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-accent/10">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-150"
              style={{ width: `${file.progress ?? 0}%` }}
            />
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            {file.status === "ready" && `${(file.size / 1024).toFixed(1)} KB`}
            {file.status === "error" && (file.errorMessage || "Failed")}
          </p>
        )}
      </div>
      {isImage && file.status === "ready" && onAnalyze && (
        <button
          onClick={() => onAnalyze(file)}
          disabled={analyzing}
          title="Analyze image"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-accent disabled:opacity-100 disabled:animate-pulse"
        >
          <Sparkles className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={() => onRemove(file.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
});
AttachmentChip.displayName = "AttachmentChip";
