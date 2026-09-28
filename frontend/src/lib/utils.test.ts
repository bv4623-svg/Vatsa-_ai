import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelativeTime } from "@/lib/utils";

describe("formatRelativeTime", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("reads naturally at each scale", () => {
    expect(formatRelativeTime(ago(20_000))).toBe("just now");
    expect(formatRelativeTime(ago(2 * 60_000))).toBe("2m ago");
    expect(formatRelativeTime(ago(3 * 3_600_000))).toBe("3h ago");
    expect(formatRelativeTime(ago(2 * 86_400_000))).toBe("2d ago");
    expect(formatRelativeTime(ago(10 * 86_400_000))).toBe(ago(10 * 86_400_000).toLocaleDateString());
  });

  it("accepts ISO strings", () => {
    expect(formatRelativeTime(ago(5 * 60_000).toISOString())).toBe("5m ago");
  });
});
