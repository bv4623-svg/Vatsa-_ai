import { describe, expect, it } from "vitest";
import { MESSAGE_MAX, MESSAGE_MIN, feedbackMessageError, feedbackPayload } from "@/services/feedback";

describe("feedbackMessageError", () => {
  it("needs 10-5000 characters, ignoring surrounding whitespace", () => {
    expect(feedbackMessageError("x".repeat(MESSAGE_MIN - 1))).toMatch(/at least 10/);
    expect(feedbackMessageError(`   ${"x".repeat(MESSAGE_MIN - 1)}   `)).toMatch(/at least 10/);
    expect(feedbackMessageError("x".repeat(MESSAGE_MIN))).toBeNull();
    expect(feedbackMessageError("x".repeat(MESSAGE_MAX))).toBeNull();
    expect(feedbackMessageError("x".repeat(MESSAGE_MAX + 1))).toMatch(/under 5000/);
  });
});

describe("feedbackPayload", () => {
  it("trims the message and sends rating as null when not given", () => {
    expect(feedbackPayload({ type: "bug", message: "  It broke on save.  " })).toEqual({ type: "bug", message: "It broke on save.", rating: null });
  });

  it("includes a trimmed email only when one was typed", () => {
    expect(feedbackPayload({ type: "praise", message: "Love the new logo!", email: " me@example.com " }).email).toBe("me@example.com");
    expect("email" in feedbackPayload({ type: "praise", message: "Love the new logo!", email: "   " })).toBe(false);
  });

  it("captures the page as an http(s) URL only", () => {
    expect(feedbackPayload({ type: "other", message: "Just a note here.", pageUrl: "https://vatsaai.com/home?x=1" }).page_url).toBe("https://vatsaai.com/home?x=1");
    expect("page_url" in feedbackPayload({ type: "other", message: "Just a note here.", pageUrl: "javascript:alert(1)" })).toBe(false);
  });
});
