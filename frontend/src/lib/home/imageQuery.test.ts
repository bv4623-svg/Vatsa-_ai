import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { extractImagePrompt, isImageGenQuery } from "./imageQuery";

type Case = { text: string; prompt: string | null };
const cases = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../../shared/image-intent-cases.json"), "utf8")
) as { chat: Case[]; code_workspace: Case[] };

describe("extractImagePrompt (shared cases with the backend)", () => {
  it.each(cases.chat)("chat: $text", ({ text, prompt }) => {
    expect(extractImagePrompt(text, "chat")).toBe(prompt);
    expect(isImageGenQuery(text)).toBe(prompt !== null);
  });

  it.each(cases.code_workspace)("code workspace never generates images: $text", ({ text, prompt }) => {
    expect(extractImagePrompt(text, "code")).toBe(prompt);
  });

  it("caps prompt length", () => {
    const p = extractImagePrompt("generate an image of " + "a very long scene ".repeat(200));
    expect(p!.length).toBeLessThanOrEqual(1000);
  });
});
