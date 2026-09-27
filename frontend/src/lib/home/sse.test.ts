import { describe, expect, it } from "vitest";
import { createSseParser, describeHttpError, describeNetworkError, researchStageLabel, type ChatStreamEvent } from "./sse";

const enc = (s: string) => new TextEncoder().encode(s);

function collect(chunks: (string | Uint8Array)[]) {
  const events: ChatStreamEvent[] = [];
  const p = createSseParser((e) => events.push(e));
  chunks.forEach((c) => p.feed(typeof c === "string" ? enc(c) : c));
  p.end();
  return events;
}

describe("createSseParser", () => {
  it("parses one event per data line", () => {
    expect(collect(['data: {"delta":"a"}\n\ndata: {"delta":"b"}\n\n'])).toEqual([{ delta: "a" }, { delta: "b" }]);
  });

  it("reassembles events split across chunks", () => {
    expect(collect(['data: {"del', 'ta":"hello"}\n', "\n"])).toEqual([{ delta: "hello" }]);
  });

  it("reassembles multi-byte characters split across chunks", () => {
    const bytes = enc('data: {"delta":"héllo 👋"}\n\n');
    const cut = bytes.indexOf(0xf0) + 2; // middle of the emoji
    expect(collect([bytes.slice(0, cut), bytes.slice(cut)])).toEqual([{ delta: "héllo 👋" }]);
  });

  it("handles a final event without a trailing newline", () => {
    expect(collect(['data: {"done":true}'])).toEqual([{ done: true }]);
  });

  it("ignores comments, blank lines and [DONE]", () => {
    expect(collect([": keepalive\n\ndata: [DONE]\n\n"])).toEqual([]);
  });

  it("treats non-JSON data as plain text", () => {
    expect(collect(["data: plain words\n"])).toEqual([{ delta: "plain words" }]);
  });

  it("passes notice, stage, error and done events through", () => {
    const evts = collect([
      'data: {"notice":"no search"}\n',
      'data: {"stage":"searching","queries":["a","b"]}\n',
      'data: {"error":"down","code":"ai_unavailable","retryable":true}\n',
    ]);
    expect(evts[0].notice).toBe("no search");
    expect(evts[1].queries).toEqual(["a", "b"]);
    expect(evts[2]).toMatchObject({ error: "down", retryable: true });
  });
});

describe("researchStageLabel", () => {
  it("labels each stage", () => {
    expect(researchStageLabel({ stage: "planning" })).toMatch(/planning/i);
    expect(researchStageLabel({ stage: "searching", queries: ["a", "b", "c"] })).toContain("3 queries");
    expect(researchStageLabel({ stage: "writing", source_count: 12 })).toContain("12 sources");
    expect(researchStageLabel({ delta: "x" })).toBeNull();
  });
});

describe("describeHttpError", () => {
  it("never shows raw JSON", () => {
    for (const status of [400, 401, 413, 422, 429, 500, 502, 503]) {
      expect(describeHttpError(status, { detail: { error: "x" } })).not.toContain("{");
    }
  });
  it("uses short string details", () => {
    expect(describeHttpError(400, { detail: "Message cannot be empty" })).toBe("Message cannot be empty");
  });
  it("maps gateway errors to a retryable message", () => {
    expect(describeHttpError(502, null)).toMatch(/temporarily unavailable/);
  });
});

describe("describeNetworkError", () => {
  it("detects offline", () => {
    expect(describeNetworkError(new TypeError("Failed to fetch"), false)).toMatch(/offline/);
  });
  it("explains fetch failures when online", () => {
    expect(describeNetworkError(new TypeError("Failed to fetch"), true)).toMatch(/Couldn't reach/);
  });
  it("keeps app error messages", () => {
    expect(describeNetworkError(new Error("Too many requests"), true)).toBe("Too many requests");
  });
});
