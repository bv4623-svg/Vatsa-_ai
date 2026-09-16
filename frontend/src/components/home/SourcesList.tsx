"use client";

import { useState } from "react";
import { Globe, ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Source } from "@/types";

const QUALITY_DOT: Record<string, string> = {
  high: "bg-green-500",
  medium: "bg-yellow-500",
  low: "bg-red-500",
};

export function SourcesList({ sources }: { sources?: Source[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!sources || sources.length === 0) return null;

  const visible = expanded ? sources : sources.slice(0, 3);

  return (
    <div className="mt-2 w-full max-w-[620px] border-t border-border/40 pt-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70 hover:text-foreground transition-colors"
      >
        <Globe className="w-3.5 h-3.5" />
        {sources.length} source{sources.length !== 1 ? "s" : ""}
        <ChevronDown className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")} />
      </button>

      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visible.map((src) => (
          <a
            key={src.index ?? src.id ?? src.url}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex gap-2 rounded-lg border border-border/40 p-2 hover:bg-accent/5 hover:border-accent/30 transition-colors"
          >
            <span className="flex-shrink-0 w-5 h-5 mt-0.5 rounded bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
              {src.index}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground/90 line-clamp-2 group-hover:text-accent">
                {src.title}
              </p>
              <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1 mt-0.5 truncate">
                {src.quality && (
                  <span className={cn("inline-block w-1.5 h-1.5 rounded-full flex-shrink-0", QUALITY_DOT[src.quality])} />
                )}
                <span className="truncate">{src.domain}</span>
                {src.published_date && (
                  <span className="flex-shrink-0">· {src.published_date.slice(0, 10)}</span>
                )}
              </p>
            </div>
            <ExternalLink className="w-3 h-3 text-muted-foreground/40 flex-shrink-0 mt-1" />
          </a>
        ))}
      </div>
    </div>
  );
}
