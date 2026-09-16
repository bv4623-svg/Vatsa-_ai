import type { Source } from "@/types";

/**
 * Turns bare "[1]" / "[2]" citation markers the model wrote into
 * clickable markdown links pointing at the matching source's URL,
 * e.g. "[1]" -> "[[1]](https://...)" which ReactMarkdown renders as a
 * link whose visible text is still "[1]".
 */
export function linkifyCitations(content: string, sources?: Source[]): string {
  if (!sources || sources.length === 0) return content;
  const byIndex = new Map(sources.map((s) => [s.index, s]));
  return content.replace(/\[(\d+)\]/g, (match, numStr) => {
    const source = byIndex.get(Number(numStr));
    if (!source) return match;
    return `[${match}](${source.url})`;
  });
}
