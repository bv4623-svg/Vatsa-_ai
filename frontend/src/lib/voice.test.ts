import { describe, expect, it } from "vitest";
import {
  appendTranscript, chunkForSpeech, getSpeechRecognitionCtor, isSpeechSynthesisSupported,
  readTranscript, speechErrorMessage, toSpeakableText,
} from "./voice";

describe("feature detection", () => {
  class Rec {}
  it("finds the standard and webkit-prefixed recognisers", () => {
    expect(getSpeechRecognitionCtor({ SpeechRecognition: Rec })).toBe(Rec);
    expect(getSpeechRecognitionCtor({ webkitSpeechRecognition: Rec })).toBe(Rec);
  });
  it("reports unsupported browsers (Firefox) and SSR", () => {
    expect(getSpeechRecognitionCtor({})).toBeNull();
    expect(getSpeechRecognitionCtor(undefined)).toBeNull();
    expect(isSpeechSynthesisSupported({})).toBe(false);
    expect(isSpeechSynthesisSupported({ speechSynthesis: {}, SpeechSynthesisUtterance: Rec })).toBe(true);
  });
});

describe("speechErrorMessage", () => {
  it("explains permission, device and network problems", () => {
    expect(speechErrorMessage("not-allowed")).toMatch(/blocked/);
    expect(speechErrorMessage("audio-capture")).toMatch(/microphone/i);
    expect(speechErrorMessage("network")).toMatch(/internet/);
    expect(speechErrorMessage("no-speech")).toMatch(/catch/);
  });
  it("is silent for a deliberate stop", () => {
    expect(speechErrorMessage("aborted")).toBeNull();
  });
  it("has a fallback", () => {
    expect(speechErrorMessage("weird")).toMatch(/try again/);
  });
});

describe("readTranscript", () => {
  const result = (transcript: string, isFinal: boolean) => ({ isFinal, 0: { transcript } });
  it("separates final and interim text from resultIndex on", () => {
    const e = { resultIndex: 1, results: [result("old ", true), result("hello ", true), result("wor", false)] };
    expect(readTranscript(e)).toEqual({ final: "hello", interim: "wor" });
  });
});

describe("appendTranscript", () => {
  it("joins with one space", () => {
    expect(appendTranscript("", "hi")).toBe("hi");
    expect(appendTranscript("hello", "world")).toBe("hello world");
    expect(appendTranscript("hello ", "world")).toBe("hello world");
    expect(appendTranscript("keep", "")).toBe("keep");
  });
});

describe("toSpeakableText", () => {
  it("drops code, links, images, citations and markdown symbols", () => {
    const md = "## Title\n**Bold** point [1][2]. See [docs](https://x.org) and https://y.org\n```js\nconsole.log(1)\n```\n- item\n![img](https://z/p.png)";
    const out = toSpeakableText(md);
    expect(out).toBe("Title Bold point . See docs and (code omitted) item");
  });
});

describe("chunkForSpeech", () => {
  it("keeps short text in one chunk", () => {
    expect(chunkForSpeech("One. Two.")).toEqual(["One. Two."]);
  });
  it("splits on sentence boundaries under the limit", () => {
    const chunks = chunkForSpeech("First sentence here. Second sentence here. Third one.", 30);
    expect(chunks).toEqual(["First sentence here.", "Second sentence here.", "Third one."]);
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(30));
  });
  it("word-wraps a single overlong sentence and hard-splits giant words", () => {
    const chunks = chunkForSpeech("word ".repeat(50) + "x".repeat(70), 40);
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(40));
    expect(chunks.join(" ").replace(/\s+/g, "")).toBe(("word".repeat(50) + "x".repeat(70)));
  });
  it("returns nothing for empty text", () => {
    expect(chunkForSpeech("")).toEqual([]);
  });
});
