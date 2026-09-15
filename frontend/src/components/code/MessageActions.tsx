"use client";

import React, { useState } from "react";
import { Copy, Check, RotateCcw, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageActionsProps {
  content: string;
  onCopy: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  showEdit?: boolean;
}

export const MessageActions = ({
  content,
  onCopy,
  onRegenerate,
  onEdit,
  showEdit,
}: MessageActionsProps) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        onClick={() => {
          navigator.clipboard.writeText(content);
          setCopied(true);
          onCopy();
          setTimeout(() => setCopied(false), 1400);
        }}
        aria-label="Copy message"
        className="rounded p-1 text-muted-foreground/60 hover:bg-accent/10 hover:text-foreground"
      >
        {copied ? (
          <Check className="h-3 w-3" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          aria-label="Regenerate"
          className="rounded p-1 text-muted-foreground/60 hover:bg-accent/10 hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
      {showEdit && onEdit && (
        <button
          onClick={onEdit}
          aria-label="Edit"
          className="rounded p-1 text-muted-foreground/60 hover:bg-accent/10 hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};
