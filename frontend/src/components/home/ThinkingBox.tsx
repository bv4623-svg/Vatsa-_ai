"use client";

import { useState } from "react";
import { ChevronDown, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Collapsible box showing the model's reasoning trace above its
 * answer. Auto-expands while the answer is still streaming (so the
 * user sees it "thinking" live) and auto-collapses once the response
 * finishes -- matches the ChatGPT/Claude "show thinking" pattern.
 */
export function ThinkingBox({ thinking, isStreaming }: { thinking?: string; isStreaming?: boolean }) {
  // Follows the stream (open while streaming, closed after) until the user
  // opens or closes it themselves.
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const expanded = userExpanded ?? !!isStreaming;

  if (!thinking) return null;

  return (
    <div className="mb-2 w-full max-w-[620px] rounded-lg border border-border/40 bg-muted/30">
      <button
        onClick={() => setUserExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground/80 hover:text-foreground transition-colors"
      >
        <Brain className="w-3.5 h-3.5" />
        {isStreaming ? "Reasoning..." : "Reasoning"}
        <ChevronDown className={cn("w-3 h-3 ml-auto transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="px-3 pb-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed border-t border-border/30 pt-2">
          {thinking}
        </div>
      )}
    </div>
  );
}
