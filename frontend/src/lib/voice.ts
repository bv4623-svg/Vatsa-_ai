/**
 * Browser-native voice: speech-to-text via the Web Speech API
 * (SpeechRecognition) and text-to-speech via speechSynthesis. No audio is
 * sent to Vatsa AI's servers; recognition is performed by the browser
 * (in Chrome/Edge that means the browser vendor's speech service).
 */

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognitionCtor(win: unknown = typeof window !== "undefined" ? window : undefined): RecognitionCtor | null {
  const w = win as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor } | undefined;
  return w?.SpeechRecognition || w?.webkitSpeechRecognition || null;
}

export function isSpeechSynthesisSupported(win: unknown = typeof window !== "undefined" ? window : undefined): boolean {
  const w = win as { speechSynthesis?: unknown; SpeechSynthesisUtterance?: unknown } | undefined;
  return !!w?.speechSynthesis && !!w?.SpeechSynthesisUtterance;
}

export function speechErrorMessage(code: string): string | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow it in your browser's site settings and try again.";
    case "audio-capture":
      return "No microphone was found. Connect one and try again.";
    case "network":
      return "Voice input needs an internet connection.";
    case "no-speech":
      return "Didn't catch that. Try again and speak after the beep.";
    case "language-not-supported":
      return "Voice input doesn't support your language setting.";
    case "aborted":
      return null; // user or app stopped it
    default:
      return "Voice input stopped unexpectedly. Please try again.";
  }
}

/** Splits recognition results into the finished text and the live guess. */
export function readTranscript(e: SpeechRecognitionEventLike): { final: string; interim: string } {
  let final = "";
  let interim = "";
  for (let i = e.resultIndex; i < e.results.length; i++) {
    const r = e.results[i];
    if (r.isFinal) final += r[0].transcript;
    else interim += r[0].transcript;
  }
  return { final: final.trim(), interim: interim.trim() };
}

/** Joins dictated text onto what's already in the composer. */
export function appendTranscript(existing: string, spoken: string): string {
  if (!spoken) return existing;
  if (!existing.trim()) return spoken;
  return /\s$/.test(existing) ? existing + spoken : `${existing} ${spoken}`;
}

/** Markdown -> plain sentences for reading aloud: no code, URLs, symbols. */
export function toSpeakableText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " (code omitted) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[\d+\]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Word-wraps text into pieces of at most maxLen characters (a single
 * word longer than maxLen is hard-split). */
function wrapWords(text: string, maxLen: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (word.length > maxLen) {
      if (line) out.push(line);
      line = "";
      for (let i = 0; i < word.length; i += maxLen) out.push(word.slice(i, i + maxLen));
      continue;
    }
    if (line && line.length + 1 + word.length > maxLen) {
      out.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) out.push(line);
  return out;
}

/** Browsers stop long utterances part-way (Chrome after ~15 s), so speech
 * is queued in chunks of whole sentences, each at most maxLen characters. */
export function chunkForSpeech(text: string, maxLen = 220): string[] {
  const sentences = (text.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) || []).map((s) => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const pieces = sentence.length > maxLen ? wrapWords(sentence, maxLen) : [sentence];
    for (const piece of pieces) {
      if (current && current.length + 1 + piece.length > maxLen) {
        chunks.push(current);
        current = piece;
      } else {
        current = current ? `${current} ${piece}` : piece;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
