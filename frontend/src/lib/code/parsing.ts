import type { ProjectFile } from "@/types/code";

export function uid(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function extractAllCodeBlocks(
  text: string
): { language: string; code: string; name: string }[] {
  const regex = /```(\w+)?\s*\n([\s\S]*?)```/g;
  const blocks: { language: string; code: string; name: string }[] = [];
  const seen = new Map<string, number>();

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const language = (match[1] || "txt").toLowerCase();
    const code = match[2].trim();
    if (!code) continue;

    const ext = {
      js: "js", javascript: "js", jsx: "jsx",
      ts: "ts", typescript: "ts", tsx: "tsx",
      html: "html", css: "css", scss: "scss",
      json: "json", python: "py", py: "py",
      go: "go", rust: "rs", java: "java",
      md: "md", markdown: "md", sql: "sql",
      sh: "sh", bash: "sh", yaml: "yml", yml: "yml",
    }[language] || language;

    const base = `file.${ext}`;
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    const name = count === 1 ? base : `file-${count}.${ext}`;

    blocks.push({ language, code, name });
  }
  return blocks;
}

export function normalizeResponse(data: any): {
  text: string;
  files: ProjectFile[];
} {
  if (data == null) {
    return { text: "_Backend returned an empty response._", files: [] };
  }

  const rawFiles = data?.files || data?.file_list || data?.artifacts;
  if (Array.isArray(rawFiles) && rawFiles.length > 0) {
    const files = rawFiles
      .map((f: any) => ({
        name: f.path || f.name || f.filename || "index.html",
        content: typeof f.content === "string" ? f.content : f.code || "",
      }))
      .filter((f) => f.content.length > 0);
    return {
      text: data?.response || data?.message || `Generated ${files.length} file(s).`,
      files,
    };
  }

  const candidate =
    (typeof data === "string" && data) ||
    data?.response ||
    data?.content ||
    data?.message ||
    data?.text ||
    data?.answer;

  if (typeof candidate === "string" && candidate.trim()) {
    const blocks = extractAllCodeBlocks(candidate);
    if (blocks.length > 0) {
      return {
        text: candidate,
        files: blocks.map((b) => ({
          name: b.name,
          content: b.code,
          language: b.language,
        })),
      };
    }
    return { text: candidate, files: [] };
  }

  return {
    text:
      "**Backend response:**\n\n```json\n" +
      JSON.stringify(data, null, 2) +
      "\n```",
    files: [],
  };
}

export function languageFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript",
    jsx: "javascript", html: "html", css: "css", json: "json",
    md: "markdown", py: "python", rs: "rust", go: "go",
    java: "java", sql: "sql", sh: "shell", yml: "yaml", yaml: "yaml",
  };
  return map[ext] || "plaintext";
}
