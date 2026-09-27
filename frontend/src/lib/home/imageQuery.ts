/**
 * Image-generation intent -- an exact mirror of detect_image_gen() in
 * Backend/app/services/ai_service.py. Both are tested against
 * shared/image-intent-cases.json so the client's loading state and the
 * server's routing can never disagree.
 *
 * Precision beats recall: a false positive replaces the answer the user
 * wanted ("draw conclusions from this data") with a picture.
 */
const PREFIX = String.raw`^(?:(?:hey|hi)[,!\s]+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?`;
const MEDIUM = String.raw`(?:image|picture|pic|photo|photograph|illustration|artwork|drawing|portrait|painting|sketch|wallpaper|logo|poster|art)`;
const VERB = String.raw`(?:generate|create|make|draw|paint|render|produce|design|sketch)`;

const TECH_WORDS = new RegExp(
  String.raw`\b(?:gallery|carousel|slider|uploader|upload|component|viewer|editor|compressor|resizer|cropper|` +
    String.raw`website|site|page|app|application|api|endpoint|function|script|class|filter|processing|processor|` +
    String.raw`pipeline|classifier|classification|recognition|detection|model|dataset|button|grid|element|tag|` +
    String.raw`chart|graph|diagram|plot|table|html|css|canvas|svg|react|python|javascript|code)\b`
);
const DRAW_NOT_PICTURES = new RegExp(
  String.raw`^(?:conclusions?|(?:a\s+)?comparisons?|(?:a\s+)?parallels?|attention|(?:a|the)\s+line|inspiration|` +
    String.raw`(?:a\s+)?distinctions?|lessons?|blood|(?:a\s+)?blank|near|up|on|from|out|back)\b`
);
const EXPLICIT_RE = /^\/?imagine\s+([\s\S]+)$/i;
const VERB_MEDIUM_RE = new RegExp(
  PREFIX + VERB + String.raw`(?:\s+me)?\s+((?:(?:an?|the|some)\s+)?(?:[\w-]+\s+){0,4}?` + MEDIUM + String.raw`\b[\s\S]*)$`,
  "i"
);
const DRAW_RE = new RegExp(PREFIX + String.raw`(?:draw|paint|sketch)(?:\s+me)?\s+([\s\S]+)$`, "i");
const OF_RE = /^((?:an?\s+)?(?:image|picture|pic)\s+of\s+[\s\S]+)$/i;
const GENERIC_LEAD_RE = /^(?:an?\s+|the\s+|some\s+)?(?:image|picture|pic)\b(?:\s+of\b)?\s*/i;

export const DEFAULT_IMAGE_PROMPT = "beautiful realistic artwork";
const MAX_IMAGE_PROMPT_CHARS = 1000;

function cleanPrompt(subject: string): string {
  const s = subject.trim().replace(GENERIC_LEAD_RE, "").trim().replace(/[?!. ]+$/, "").trim();
  return (s || DEFAULT_IMAGE_PROMPT).slice(0, MAX_IMAGE_PROMPT_CHARS);
}

/** The prompt the server will send to the image model, or null. */
export function extractImagePrompt(text: string, workspace: "chat" | "code" = "chat"): string | null {
  if (workspace === "code") return null;
  const t = (text || "").trim();
  if (!t) return null;

  let m = EXPLICIT_RE.exec(t);
  if (m) return cleanPrompt(m[1]);

  if (TECH_WORDS.test(t.toLowerCase())) return null;

  m = VERB_MEDIUM_RE.exec(t);
  if (m) return cleanPrompt(m[1]);

  m = DRAW_RE.exec(t);
  if (m && !DRAW_NOT_PICTURES.test(m[1].toLowerCase())) return cleanPrompt(m[1]);

  m = OF_RE.exec(t);
  if (m) return cleanPrompt(m[1]);
  return null;
}

export const isImageGenQuery = (text: string, workspace: "chat" | "code" = "chat"): boolean =>
  extractImagePrompt(text, workspace) !== null;
