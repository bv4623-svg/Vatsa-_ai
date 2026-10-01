/**
 * Image-generation intent -- an exact mirror of detect_image_gen() in
 * Backend/app/services/ai_service.py. Both are tested against
 * shared/image-intent-cases.json so the client's loading state and the
 * server's routing can never disagree.
 *
 * Precision beats recall: a false positive replaces the answer the user
 * wanted ("draw a conclusion", "generate a report") with a picture.
 */
const PREFIX = String.raw`^(?:(?:hey|hi)[,!\s]+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?`;
const MEDIUM = String.raw`(?:image|picture|pic|photo|photograph|illustration|artwork|drawing|portrait|painting|sketch|wallpaper|logo|poster|art)`;
const VERB = String.raw`(?:(?:generate|create|make|draw|paint|render|produce|design|sketch)(?:\s+me)?|(?:show|give|send)\s+me)`;

// Software, charts or image *processing*, not a request for a picture.
const TECH_WORDS = new RegExp(
  String.raw`\b(?:gallery|carousel|slider|uploader|upload|component|viewer|editor|compressor|resizer|cropper|` +
    String.raw`website|site|page|app|application|api|endpoint|function|script|class|filter|processing|processor|` +
    String.raw`pipeline|classifier|classification|recognition|detection|model|dataset|button|grid|element|tag|` +
    String.raw`chart|graph|diagram|plot|table|html|css|canvas|svg|react|python|javascript|code)\b`
);
// "draw <these>" is an idiom, not a picture.
const DRAW_NOT_PICTURES = new RegExp(
  String.raw`^(?:(?:a|an|the|some|any)\s+)?(?:conclusions?|comparisons?|parallels?|attention|lines?|inspiration|` +
    String.raw`distinctions?|lessons?|blood|blank|breath|straws?|lots?|fire|crowds?|criticism|interest|` +
    String.raw`near|up|on|from|out|back)\b`
);
// "generate a <these>" asks for text or data, not a picture.
const GENERATE_TEXT_WORDS = new RegExp(
  String.raw`\b(?:reports?|summary|summaries|lists?|e-?mails?|essays?|story|stories|poems?|letters?|articles?|` +
    String.raw`blogs?|posts?|tweets?|captions?|titles?|headlines?|slogans?|taglines?|names?|usernames?|passwords?|` +
    String.raw`passphrases?|keys?|tokens?|uuids?|hash(?:es)?|numbers?|random|ideas?|questions?|quiz(?:zes)?|` +
    String.raw`answers?|responses?|repl(?:y|ies)|outlines?|plans?|schedules?|timetables?|itinerar(?:y|ies)|` +
    String.raw`quer(?:y|ies)|regex(?:es)?|json|csv|xml|yaml|sql|invoices?|resumes?|cv|descriptions?|bios?|` +
    String.raw`paragraphs?|sentences?|text|messages?|prompts?|jokes?|riddles?|songs?|lyrics|speech(?:es)?|` +
    String.raw`presentations?|slides?|documents?|docs?|pdfs?|contracts?|proposals?|tests?|programs?|budgets?|` +
    String.raw`recipes?|workouts?|diets?|translations?|words?|lessons?|syllabus|notes?|comments?|reviews?|` +
    String.raw`feedback|faqs?|polic(?:y|ies))\b`
);
const EXPLICIT_RE = /^\/?imagine\s+([\s\S]+)$/i;
const VERB_MEDIUM_RE = new RegExp(
  PREFIX + VERB + String.raw`\s+((?:(?:an?|the|some)\s+)?(?:[\w-]+\s+){0,4}?` + MEDIUM + String.raw`\b[\s\S]*)$`,
  "i"
);
const DRAW_RE = new RegExp(PREFIX + String.raw`(?:draw|paint|sketch)(?:\s+me)?\s+([\s\S]+)$`, "i");
const OF_RE = /^((?:an?\s+)?(?:image|picture|pic)\s+of\s+[\s\S]+)$/i;
const GENERATE_RE = new RegExp(PREFIX + String.raw`generate(?:\s+me)?\s+((?:an?|some|\d+)\s+[\s\S]+)$`, "i");
// Hinglish: an image word right before a "make" verb ("image banao",
// "photo bana do", "ek image generate karo"); the subject can sit on either
// side ("ek red apple ki image banao", "image banao ek ghode ka").
const HINGLISH_RE = new RegExp(
  String.raw`\b(?:image|imej|photo|foto|pic|picture|pik|tasveer|tasvir|chitra|drawing|painting|wallpaper|logo|poster)s?\s+` +
    String.raw`(?:banao|bana\s+do|banado|bana\s+dijiye|bana\s+de|bana\s+ke\s+do|banaiye|banaye|bnao|bna\s+do|` +
    String.raw`generate\s+(?:karo|kar\s+do|kardo|kar\s+dijiye|kar\s+de)|create\s+(?:karo|kar\s+do|kardo))\b`,
  "i"
);
const HINGLISH_LEAD_RE = new RegExp(
  String.raw`^(?:(?:ek|mujhe|mere\s+liye|mera|meri|please|plz|pls|zara|jaldi|bhai|yaar|ab|aur)(?:\s+|$))+`,
  "i"
);
const HINGLISH_TRAIL_RE = new RegExp(
  String.raw`(?:(?:^|\s+)(?:ki|ka|ke|ko|wali|wala|wale|please|plz|pls|na|yaar|bhai))+$`,
  "i"
);
// Hindi (Devanagari), matched after NFC normalisation; ़ is the nukta,
// so both "फोटो" and "फ़ोटो" match.
const HINDI_RE = new RegExp(
  "(?:चित्र|फ़?ोटो|इमेज|तस्वीर|पिक्चर|छवि)\\s*" +
    "(?:बनाओ|बना\\s*दो|बना\\s*दीजिए|बना\\s*दीजिये|बना\\s*दें|बना\\s*दे|बनाइए|बनाइये|बनाएं|बनाएँ)"
);
const HINDI_LEAD_RE = new RegExp("^(?:(?:एक|मुझे|मेरे\\s+लिए|मेरे\\s+लिये|कृपया|ज़?रा|प्लीज़?)(?:\\s+|$))+");
const HINDI_TRAIL_RE = new RegExp("(?:(?:^|\\s+)(?:का|की|के|को|वाला|वाली|वाले))+$");
const GENERIC_LEAD_RE = /^(?:an?\s+|the\s+|some\s+)?(?:image|picture|pic)\b(?:\s+of\b)?\s*/i;

export const DEFAULT_IMAGE_PROMPT = "beautiful realistic artwork";
const MAX_IMAGE_PROMPT_CHARS = 1000;

function cleanPrompt(subject: string): string {
  const s = subject.trim().replace(GENERIC_LEAD_RE, "").trim().replace(/[?!. ]+$/, "").trim();
  return (s || DEFAULT_IMAGE_PROMPT).slice(0, MAX_IMAGE_PROMPT_CHARS);
}

function subjectWithout(text: string, m: RegExpExecArray, lead: RegExp, trail: RegExp): string {
  let rest = (text.slice(0, m.index) + " " + text.slice(m.index + m[0].length)).trim();
  rest = rest.replace(/[?!.,]+$/, "").trim();
  rest = rest.replace(lead, "").trim();
  return rest.replace(trail, "").trim();
}

/** The prompt the server will send to the image model, or null. */
export function extractImagePrompt(text: string, workspace: "chat" | "code" = "chat"): string | null {
  if (workspace === "code") return null;
  const t = (text || "").normalize("NFC").replace(/\s+/g, " ").trim();
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

  m = GENERATE_RE.exec(t);
  if (m && !GENERATE_TEXT_WORDS.test(m[1].toLowerCase())) return cleanPrompt(m[1]);

  m = HINGLISH_RE.exec(t);
  if (m) return cleanPrompt(subjectWithout(t, m, HINGLISH_LEAD_RE, HINGLISH_TRAIL_RE));

  m = HINDI_RE.exec(t);
  if (m) return cleanPrompt(subjectWithout(t, m, HINDI_LEAD_RE, HINDI_TRAIL_RE));
  return null;
}

export const isImageGenQuery = (text: string, workspace: "chat" | "code" = "chat"): boolean =>
  extractImagePrompt(text, workspace) !== null;
