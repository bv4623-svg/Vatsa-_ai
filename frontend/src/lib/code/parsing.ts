import type { ProjectFile } from "@/types/code";

export function uid(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const FILE_NAME_RE = /^[\w@.\-/]+\.[a-z0-9]{1,6}$/i;
const LANG_EXT: Record<string, string> = {
  js: "js", javascript: "js", jsx: "jsx",
  ts: "ts", typescript: "ts", tsx: "tsx",
  html: "html", css: "css", scss: "scss",
  json: "json", python: "py", py: "py",
  go: "go", rust: "rs", java: "java",
  md: "md", markdown: "md", sql: "sql",
  sh: "sh", bash: "sh", yaml: "yml", yml: "yml",
};

const cleanName = (n: string) => n.trim().replace(/^[`*"'(]+|[`*"':)]+$/g, "").replace(/^\.\//, "");
const asFileName = (n: string | undefined) => {
  const c = n ? cleanName(n) : "";
  return c && FILE_NAME_RE.test(c) && !c.startsWith("/") && !c.includes("..") ? c : null;
};

/** The file name the model gave a block, from (in order): the fence info
 * string ("```html index.html", "```css:styles.css", "```js title=app.js"),
 * a first-line comment ("<!-- index.html -->", "// app.js", "# main.py"),
 * or the line right before the fence ("**index.html**", "`styles.css`:"). */
export function detectFileName(info: string, code: string, preceding: string): string | null {
  const infoRest = info.replace(/^[\w+#-]+/, "").replace(/^[:\s]+/, "");
  const attr = /(?:title|filename|file|name)\s*=\s*["']?([^"'\s]+)/i.exec(infoRest);
  const fromInfo = asFileName(attr?.[1]) || asFileName(infoRest.split(/\s+/)[0]);
  if (fromInfo) return fromInfo;

  const first = code.split("\n", 1)[0].trim();
  const comment = /^(?:<!--\s*(.+?)\s*-->|\/\/\s*(.+)|\/\*\s*(.+?)\s*\*\/|#\s*(.+))$/.exec(first);
  if (comment) {
    const text = (comment[1] || comment[2] || comment[3] || comment[4] || "").replace(/^(?:file(?:name)?|path)\s*:\s*/i, "");
    const fromComment = asFileName(text.split(/\s+/)[0]);
    if (fromComment) return fromComment;
  }

  const lastLine = preceding.trimEnd().split("\n").pop() || "";
  const heading = /(?:^|\s)[`*_#]*([\w@.\-/]+\.[a-z0-9]{1,6})[`*_]*\s*:?\s*$/i.exec(lastLine);
  return asFileName(heading?.[1]);
}

export function extractAllCodeBlocks(
  text: string
): { language: string; code: string; name: string }[] {
  const regex = /```([^\n`]*)\n([\s\S]*?)```/g;
  const blocks: { language: string; code: string; name: string }[] = [];
  const used = new Set<string>();
  const seen = new Map<string, number>();

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const info = match[1].trim();
    const langToken = (/^[\w+#-]+/.exec(info)?.[0] || "").toLowerCase();
    const code = match[2].trim();
    if (!code) continue;

    const named = detectFileName(info, code, text.slice(0, match.index));
    const language = langToken || (named ? named.split(".").pop()!.toLowerCase() : "txt");

    let name: string;
    if (named && !used.has(named)) {
      name = named;
    } else {
      const ext = LANG_EXT[language] || language;
      const base = `file.${ext}`;
      let count = seen.get(base) || 0;
      do {
        count += 1;
        name = count === 1 ? base : `file-${count}.${ext}`;
      } while (used.has(name));
      seen.set(base, count);
    }
    used.add(name);
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

  // Never echo the raw payload: it can carry internal fields and isn't a reply.
  return {
    text: "_Unexpected response from the server. Please try again._",
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
