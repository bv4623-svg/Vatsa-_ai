"use client";

import { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";

type State = "idle" | "copied" | "failed";
const LABEL: Record<State, string> = { idle: "Copy code", copied: "Copied", failed: "Copy failed" };

/** Copy button for code blocks. The clipboard can be refused (permissions,
 * insecure context), so failure is caught and shown instead of becoming an
 * unhandled promise rejection with no feedback. */
export function CodeCopyButton({ text }: { text: string }) {
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 1500);
    return () => clearTimeout(t);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  const Icon = state === "copied" ? Check : state === "failed" ? X : Copy;
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={LABEL[state]}
      title={LABEL[state]}
      className="rounded bg-black/20 p-1 text-white/60 hover:bg-black/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}
