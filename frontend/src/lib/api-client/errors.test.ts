import { describe, expect, it } from "vitest";
import { describeApiError } from "./errors";
import { normalizeResponse } from "@/lib/code/parsing";

describe("describeApiError", () => {
  it("uses a plain string detail", () => {
    expect(describeApiError({ detail: "Incorrect password" }, 400)).toBe("Incorrect password");
  });
  it("turns plan/limit codes into sentences, never raw codes", () => {
    expect(describeApiError({ detail: { error: "storage_limit_reached" } }, 413)).toMatch(/storage is full/i);
    expect(describeApiError({ detail: { error: "daily_limit_reached", limit: 25 } }, 429)).toMatch(/daily limit/i);
    expect(describeApiError({ detail: { error: "upgrade_required", feature: "api_keys" } }, 402)).toMatch(/paid plan/i);
    for (const code of ["storage_limit_reached", "daily_limit_reached", "upgrade_required"]) {
      expect(describeApiError({ detail: { error: code } }, 400)).not.toContain(code);
    }
  });
  it("summarises FastAPI validation errors instead of [object Object]", () => {
    const body = { detail: [{ loc: ["body", "message"], msg: "String should have at most 200000 characters", type: "string_too_long" }] };
    const text = describeApiError(body, 422);
    expect(text).toBe("message: String should have at most 200000 characters");
    expect(text).not.toContain("object");
  });
  it("never shows long or HTML bodies", () => {
    expect(describeApiError({ detail: "x".repeat(400) }, 500)).toMatch(/something went wrong/i);
    expect(describeApiError("<html>502 Bad Gateway</html>", 502)).toMatch(/temporarily unavailable/i);
  });
  it("falls back by status, with the caller's fallback for unknown statuses", () => {
    expect(describeApiError(null, 401)).toMatch(/sign in/i);
    expect(describeApiError(null, 429)).toMatch(/too many/i);
    expect(describeApiError(null, 418, "Login failed")).toBe("Login failed");
  });
});

describe("normalizeResponse", () => {
  it("never dumps raw backend JSON into the chat", () => {
    const out = normalizeResponse({ unexpected: { internal_id: 42 } });
    expect(out.text).not.toContain("internal_id");
    expect(out.text).not.toContain("```json");
    expect(out.text).toMatch(/unexpected response/i);
  });
});
