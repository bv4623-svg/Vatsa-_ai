import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_BASE } from "@/config/api";
import { afterSignIn, forgetAfterSignIn, startOAuth } from "@/lib/oauth";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  assign = vi.fn();
  vi.stubGlobal("window", { location: { assign } });
  vi.stubGlobal("sessionStorage", memoryStorage());
});

afterEach(() => vi.unstubAllGlobals());

describe("OAuth round trip", () => {
  it("goes to the provider and comes back to the page sign-in was started for", () => {
    startOAuth("github", "/checkout?plan=pro");
    expect(assign).toHaveBeenCalledWith(`${API_BASE}/api/auth/github/login`);
    expect(afterSignIn()).toBe("/checkout?plan=pro");
  });

  it("a plain sign-in clears an older destination", () => {
    startOAuth("google", "/checkout?plan=pro");
    startOAuth("google");
    expect(afterSignIn()).toBe("/home");
  });

  it("never sends a signed-in user off-site", () => {
    startOAuth("google", "//evil.example/steal");
    expect(afterSignIn()).toBe("/home");
    sessionStorage.setItem("vatsa:after-sign-in", "https://evil.example");
    expect(afterSignIn()).toBe("/home");
  });

  it("is forgotten once used", () => {
    startOAuth("google", "/pricing");
    forgetAfterSignIn();
    expect(afterSignIn()).toBe("/home");
  });

  it("still signs in when storage is blocked", () => {
    const blocked = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("sessionStorage", { getItem: blocked, setItem: blocked, removeItem: blocked });
    startOAuth("google", "/checkout?plan=pro");
    expect(assign).toHaveBeenCalledOnce();
    expect(afterSignIn()).toBe("/home");
    expect(() => forgetAfterSignIn()).not.toThrow();
  });
});
