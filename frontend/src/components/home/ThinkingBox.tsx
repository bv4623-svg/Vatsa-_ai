"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Collapsible box showing the model's reasoning trace above its
 * answer. Auto-expands while the answer is still streaming (so the
 * user sees it "thinking" live) and auto-collapses once the response
 * finishes -- matches the ChatGPT/Claude "show thinking" pattern.
 */
export function ThinkingBox({ thinking, isStreaming }: { thinking?: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const [userToggled, setUserToggled] = useState(false);

  useEffect(() => {
    if (!isStreaming && !userToggled) setExpanded(false);
  }, [isStreaming, userToggled]);

  if (!thinking) return null;

  return (
    <div className="mb-2 w-full max-w-[620px] rounded-lg border border-border/40 bg-muted/30">
      <button
        onClick={() => { setExpanded((v) => !v); setUserToggled(true); }}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground/80 hover:text-foreground transition-colors"
      >
        <Brain className="w-3.5 h-3.5" />
        {isStreaming ? "Reasoning..." : "Reasoning"}
        <ChevronDown className={cn("w-3 h-3 ml-auto transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="px-3 pb-3 text-xs text-muted-foreground/70 whitespace-pre-wrap leading-relaxed border-t border-border/30 pt-2">
          {thinking}
        </div>
      )}
    </div>
  );
}
