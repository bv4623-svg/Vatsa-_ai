/** Real text-to-speech via the browser's native SpeechSynthesis API -- no
 * backend call, no third-party service. Free and built into Chrome, Edge
 * and Safari (varying voice quality/availability per browser/OS), which
 * is exactly why this is the right default before a paid cloud voice
 * (ElevenLabs, etc.) is worth adding on top of it. */

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (!isTtsSupported()) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) cachedVoices = voices;
  return cachedVoices;
}

if (isTtsSupported()) {
  loadVoices();
  // Chrome loads the voice list asynchronously; the first call above is
  // frequently empty on a fresh page load.
  window.speechSynthesis.onvoiceschanged = () => loadVoices();
}

/** The product's 5 named "assistant voice" options (Settings -> Voice) are
 * brand labels, not real SpeechSynthesisVoice names -- those vary wildly
 * per OS/browser ("Google US English", "Microsoft Zira", "Samantha", ...).
 * Maps each label to a real available voice via a gender-leaning heuristic,
 * deterministically (same label -> same voice on a given browser) so
 * "Test voice" and auto-read never disagree. */
const VOICE_NAME_HINTS: Record<string, RegExp> = {
  Amy: /female|woman|zira|samantha|victoria|karen|moira|tessa|susan|anna|salli|joanna/i,
  Emma: /female|woman|zira|samantha|victoria|karen|moira|tessa|susan|anna|salli|joanna/i,
  Sofia: /female|woman|zira|samantha|victoria|karen|moira|tessa|susan|anna|salli|joanna/i,
  Brian: /male|man|david|mark|daniel|alex|fred|george|guy|matthew/i,
  James: /male|man|david|mark|daniel|alex|fred|george|guy|matthew/i,
};

export function resolveVoice(label?: string): SpeechSynthesisVoice | null {
  const voices = loadVoices();
  if (!voices.length) return null;

  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = english.length ? english : voices;

  const hint = label ? VOICE_NAME_HINTS[label] : undefined;
  if (hint) {
    const match = pool.find((v) => hint.test(v.name));
    if (match) return match;
  }

  // Deterministic fallback: hash the label to a stable index into the
  // pool, so the same unmatched label always lands on the same voice
  // instead of silently defaulting to index 0 for everyone.
  const key = label || "default";
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return pool[hash % pool.length] || null;
}

export interface SpeakOptions {
  voiceLabel?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

/** Speaks `text` aloud. Cancels any speech already in progress first --
 * SpeechSynthesis queues utterances by default, which would otherwise
 * read every reply back-to-back instead of just the latest one. */
export function speak(text: string, opts: SpeakOptions = {}): boolean {
  if (!isTtsSupported() || !text.trim()) return false;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = resolveVoice(opts.voiceLabel);
  if (voice) utterance.voice = voice;
  utterance.rate = opts.rate ?? 1;
  utterance.pitch = opts.pitch ?? 1;
  utterance.volume = opts.volume ?? 1;
  utterance.onend = () => opts.onEnd?.();
  utterance.onerror = (e) => opts.onError?.(e.error || "Speech synthesis failed");

  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if (isTtsSupported()) window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  return isTtsSupported() && window.speechSynthesis.speaking;
}
