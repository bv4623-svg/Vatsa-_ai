"use client";

import { useState } from "react";
import { ImageOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatImageProps {
  src?: string;
  alt?: string;
  className?: string;
}

/** Chat image that shows a spinner, the image, or a retryable error -- never the browser's broken-image icon. */
export function ChatImage({ src, alt, className }: ChatImageProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  if (!src) return null;

  // Cache-bust retries so the browser doesn't replay its cached failed response.
  const attemptSrc = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;

  if (status === "error") {
    return (
      <span
        role="alert"
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border border-border bg-card/50 px-6 py-8 text-sm text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="h-6 w-6" aria-hidden />
        Image failed to load.
        <button
          type="button"
          onClick={() => {
            setStatus("loading");
            setAttempt((a) => a + 1);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/10"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry
        </button>
      </span>
    );
  }

  return (
    // Until the image loads it has no size, so the loading box needs its own.
    <span className={cn("relative inline-block", status === "loading" && "min-h-48 min-w-48", className)}>
      {status === "loading" && (
        <span role="status" aria-label="Loading image" className="absolute inset-0 flex items-center justify-center rounded-xl bg-card/50">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={attempt}
        src={attemptSrc}
        alt={alt || "Generated image"}
        className={cn("max-w-full rounded-xl transition-opacity duration-200", status === "loading" ? "opacity-0" : "opacity-100")}
        onLoad={() => setStatus("ready")}
        onError={() => setStatus("error")}
      />
    </span>
  );
}
