import { afterEach, describe, expect, it, vi } from "vitest";

const VOICES = [
  { name: "Google UK English Female", lang: "en-GB" },
  { name: "Google UK English Male", lang: "en-GB" },
  { name: "Microsoft Zira", lang: "en-US" },
  { name: "Microsoft David", lang: "en-US" },
  { name: "Google Deutsch", lang: "de-DE" },
];

async function loadWithVoices(voices: typeof VOICES) {
  vi.resetModules();
  vi.stubGlobal("window", { speechSynthesis: { getVoices: () => voices, onvoiceschanged: null } });
  return import("@/lib/voice/tts");
}

afterEach(() => vi.unstubAllGlobals());

describe("resolveVoice", () => {
  it("gives the male labels a male voice even when a Female voice is listed first", async () => {
    const { resolveVoice } = await loadWithVoices(VOICES);
    expect(resolveVoice("Brian")?.name).toBe("Google UK English Male");
    expect(resolveVoice("James")?.name).toBe("Google UK English Male");
  });

  it("gives the female labels a female voice", async () => {
    const { resolveVoice } = await loadWithVoices(VOICES);
    expect(resolveVoice("Emma")?.name).toBe("Google UK English Female");
  });

  it("prefers English and is deterministic for unmatched labels", async () => {
    const { resolveVoice } = await loadWithVoices([{ name: "Voice A", lang: "en-US" }, { name: "Voice B", lang: "en-GB" }, { name: "Voz", lang: "es-ES" }]);
    const first = resolveVoice("Emma")?.name;
    expect(first).toMatch(/^Voice [AB]$/);
    expect(resolveVoice("Emma")?.name).toBe(first);
  });

  it("returns null when the browser has no voices", async () => {
    const { resolveVoice } = await loadWithVoices([]);
    expect(resolveVoice("Emma")).toBeNull();
  });
});
