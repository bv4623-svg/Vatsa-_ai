import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_MESSAGE_CHARS, messageCounter } from "@/lib/chat-limits";

describe("messageCounter", () => {
  it("stays hidden until the message is near the limit", () => {
    expect(messageCounter(0).show).toBe(false);
    expect(messageCounter(179_999).show).toBe(false);
    expect(messageCounter(180_000)).toEqual({ show: true, over: false, text: "180,000 / 200,000" });
  });

  it("flags a message over the limit", () => {
    expect(messageCounter(200_000).over).toBe(false);
    expect(messageCounter(200_001)).toMatchObject({ show: true, over: true });
  });

  it("matches the limit the API enforces", () => {
    const chatPy = readFileSync(join(__dirname, "..", "..", "..", "Backend", "app", "routers", "chat.py"), "utf8");
    const backend = Number(chatPy.match(/^MAX_MESSAGE_CHARS\s*=\s*([\d_]+)/m)?.[1].replace(/_/g, ""));
    expect(backend).toBe(MAX_MESSAGE_CHARS);
  });
});
