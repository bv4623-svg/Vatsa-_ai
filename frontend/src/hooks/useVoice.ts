import { useCallback, useEffect, useRef, useState } from "react";
import {
  chunkForSpeech, getSpeechRecognitionCtor, isSpeechSynthesisSupported, readTranscript,
  speechErrorMessage, toSpeakableText, type SpeechRecognitionLike,
} from "@/lib/voice";
import { resolveVoice } from "@/lib/voice/tts";

interface UseSpeechRecognitionOptions {
  lang?: string;
  /** Called with each finished phrase. */
  onFinal: (text: string) => void;
  /** Called once listening stops, with everything recognised this session. */
  onEnd?: (sessionText: string) => void;
}

/** Dictation through the browser's SpeechRecognition. `supported` is false
 * until mounted (and in Firefox, which has no implementation). */
export function useSpeechRecognition({ lang, onFinal, onEnd }: UseSpeechRecognitionOptions) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const sessionText = useRef("");
  const callbacks = useRef({ onFinal, onEnd });
  useEffect(() => {
    callbacks.current = { onFinal, onEnd };
  }, [onFinal, onEnd]);

  useEffect(() => {
    // Feature detection has to wait for the browser; the server render
    // always reports "unsupported".
    const id = requestAnimationFrame(() => setSupported(!!getSpeechRecognitionCtor()));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => () => recRef.current?.abort(), []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Voice input isn't supported in this browser. Try Chrome, Edge or Safari.");
      return;
    }
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = lang || (typeof navigator !== "undefined" ? navigator.language : "en-US");
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    sessionText.current = "";
    rec.onstart = () => {
      setListening(true);
      setError(null);
    };
    rec.onresult = (e) => {
      const { final, interim: live } = readTranscript(e);
      setInterim(live);
      if (final) {
        sessionText.current = sessionText.current ? `${sessionText.current} ${final}` : final;
        callbacks.current.onFinal(final);
      }
    };
    rec.onerror = (e) => setError(speechErrorMessage(e.error));
    rec.onend = () => {
      setListening(false);
      setInterim("");
      recRef.current = null;
      callbacks.current.onEnd?.(sessionText.current);
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      setError("Voice input is already running.");
    }
  }, [lang]);

  const toggle = useCallback(() => (listening ? stop() : start()), [listening, start, stop]);

  return { supported, listening, interim, error, clearError: () => setError(null), start, stop, toggle };
}

/** Read-aloud through speechSynthesis, one message at a time. `voiceLabel`
 * is the Settings -> Voice choice ("Emma", "Brian", ...), mapped to a real
 * browser voice by resolveVoice. */
export function useSpeechSynthesis(lang?: string, voiceLabel?: string) {
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const runRef = useRef(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setSupported(isSpeechSynthesisSupported()));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => () => {
    if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
  }, []);

  const stop = useCallback(() => {
    runRef.current += 1;
    if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  const speak = useCallback((id: string, markdown: string) => {
    if (!isSpeechSynthesisSupported()) return;
    const chunks = chunkForSpeech(toSpeakableText(markdown));
    window.speechSynthesis.cancel();
    const run = ++runRef.current;
    if (!chunks.length) {
      setSpeakingId(null);
      return;
    }
    setSpeakingId(id);
    const voice = resolveVoice(voiceLabel);
    chunks.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      if (lang) u.lang = lang;
      if (i === chunks.length - 1) {
        u.onend = () => { if (runRef.current === run) setSpeakingId(null); };
      }
      u.onerror = () => { if (runRef.current === run) setSpeakingId(null); };
      window.speechSynthesis.speak(u);
    });
  }, [lang, voiceLabel]);

  const toggle = useCallback(
    (id: string, markdown: string) => (speakingId === id ? stop() : speak(id, markdown)),
    [speakingId, speak, stop]
  );

  return { supported, speakingId, speak, stop, toggle };
}
