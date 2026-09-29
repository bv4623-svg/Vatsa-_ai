"use client";

import { memo } from "react";
import { Paperclip, X, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import type { Attachment } from "@/types/home";
import { formatBytes } from "@/lib/format-bytes";

interface AttachmentChipProps {
  file: Attachment;
  onRemove: (id: string) => void;
  onAnalyze?: (file: Attachment) => void;
  analyzing?: boolean;
}

export const AttachmentChip = memo(({ file, onRemove, onAnalyze, analyzing }: AttachmentChipProps) => {
  const isImage = file.type.startsWith("image/");
  const isError = file.status === "error";
  const detail =
    file.status === "processing"
      ? file.progress && file.progress < 100
        ? `Uploading… ${file.progress}%`
        : "Processing…"
      : isError
      ? file.error || "Failed"
      : file.warning || formatBytes(file.size);
  // Action buttons are always visible on touch screens (no hover there) and
  // whenever they have keyboard focus; on desktop they reveal on hover.
  const actionClass =
    "transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 text-muted-foreground rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

  return (
    <div
      role="group"
      aria-label={`Attachment ${file.name}${isError ? `, failed: ${detail}` : ""}`}
      title={isError || file.warning ? `${file.name}: ${detail}` : file.name}
      className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs max-w-[260px] ${
        isError ? "border-red-500/50 bg-red-500/5" : "border-border bg-card/70"
      }`}
    >
      {file.preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file.preview} alt="" className="h-8 w-8 rounded object-cover" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded bg-accent/10">
          {file.status === "processing" ? (
            <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />
          ) : isError ? (
            <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden />
          ) : (
            <Paperclip className="h-4 w-4 text-accent" aria-hidden />
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{file.name}</p>
        <p
          className={`truncate text-[10px] ${isError ? "text-red-500" : file.warning ? "text-amber-500" : "text-muted-foreground"}`}
          aria-live="polite"
        >
          {detail}
        </p>
        {file.status === "processing" && (
          <div
            role="progressbar"
            aria-label={`Uploading ${file.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={file.progress ?? 0}
            className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-accent/10"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-150"
              style={{ width: `${file.progress ?? 0}%` }}
            />
          </div>
        )}
      </div>
      {isImage && file.status === "ready" && onAnalyze && (
        <button
          type="button"
          onClick={() => onAnalyze(file)}
          disabled={analyzing}
          aria-label={`Analyze image ${file.name}`}
          title="Analyze image"
          className={`${actionClass} hover:text-accent disabled:opacity-100 disabled:animate-pulse`}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={() => onRemove(file.id)}
        aria-label={`Remove ${file.name}`}
        className={`${actionClass} hover:text-foreground`}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
});
AttachmentChip.displayName = "AttachmentChip";
