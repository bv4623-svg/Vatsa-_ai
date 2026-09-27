/** Real speech-to-text via the browser's native SpeechRecognition API (aka
 * webkitSpeechRecognition in Chrome/Edge) -- no backend call. Safari's
 * support is limited/inconsistent, so isSttSupported() is the real gate,
 * not a browser sniff. */

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSttSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export interface ListenOptions {
  onInterimResult?: (text: string) => void;
  onFinalResult: (text: string) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
  lang?: string;
}

export interface ListenHandle {
  stop: () => void;
}

/** Starts listening once. Fires onFinalResult with the recognized text
 * when the browser considers an utterance complete, or when stop() is
 * called manually. Returns null if this browser has no SpeechRecognition
 * implementation at all. */
export function startListening(opts: ListenOptions): ListenHandle | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    opts.onError?.("Speech recognition isn't supported in this browser");
    return null;
  }

  const recognition = new Ctor();
  recognition.lang = opts.lang || "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  let finalTranscript = "";

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) finalTranscript += result[0].transcript;
      else interim += result[0].transcript;
    }
    if (interim) opts.onInterimResult?.(interim);
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    if (event.error === "no-speech" || event.error === "aborted") return;
    opts.onError?.(event.error || "Speech recognition failed");
  };

  recognition.onend = () => {
    if (finalTranscript.trim()) opts.onFinalResult(finalTranscript.trim());
    opts.onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    opts.onError?.("Could not start the microphone");
    return null;
  }

  return { stop: () => recognition.stop() };
}
