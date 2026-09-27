"use client";

import { useState } from "react";
import { ImageOff, RefreshCw } from "lucide-react";

interface ChatImageProps {
  src?: string;
  alt?: string;
}

/** Markdown's default <img> rendering shows the browser's bare broken-image
 * icon on any load failure (a cold-started backend taking 40-60s to wake
 * on Render's free tier, an expired media token, a network blip) with no
 * way to recover short of reloading the whole page. This always shows a
 * real state instead: loading, the image, or a clear failure with retry. */
export function ChatImage({ src, alt }: ChatImageProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  if (!src) return null;

  // Cache-busts the retry so a transient failure (the exact case a cold
  // backend produces) doesn't just hit the browser's cached failed request.
  const attemptSrc = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;

  if (status === "error") {
    return (
      <span className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card/50 px-6 py-8 text-sm text-muted-foreground">
        <ImageOff className="h-6 w-6" />
        Image failed to load.
        <button
          type="button"
          onClick={() => {
            setStatus("loading");
            setAttempt((a) => a + 1);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/10"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </span>
    );
  }

  return (
    <span className="relative inline-block">
      {status === "loading" && (
        <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-card/50">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={attemptSrc}
        alt={alt || "Generated image"}
        className={status === "loading" ? "opacity-0" : "opacity-100"}
        style={{ maxWidth: "100%", borderRadius: "0.75rem", transition: "opacity 0.2s ease" }}
        onLoad={() => setStatus("ready")}
        onError={() => setStatus("error")}
      />
    </span>
  );
}
