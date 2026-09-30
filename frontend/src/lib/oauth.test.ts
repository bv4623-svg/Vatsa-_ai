import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_BASE } from "@/config/api";
import { CAPTCHA_FIELD, afterSignIn, forgetAfterSignIn, startOAuth } from "@/lib/oauth";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

interface FakeForm {
  method: string;
  action: string;
  fields: { type: string; name: string; value: string }[];
  appendChild: (field: FakeForm["fields"][number]) => void;
  submit: () => void;
}

/** The few document calls startOAuth makes; records each submitted form. */
function fakeDocument(submitted: FakeForm[]) {
  return {
    createElement: (tag: string) => {
      if (tag === "input") return { type: "", name: "", value: "" };
      const form: FakeForm = {
        method: "",
        action: "",
        fields: [],
        appendChild: (field) => void form.fields.push(field),
        submit: () => void submitted.push(form),
      };
      return form;
    },
    body: { appendChild: () => undefined },
  };
}

let submitted: FakeForm[];

beforeEach(() => {
  submitted = [];
  vi.stubGlobal("document", fakeDocument(submitted));
  vi.stubGlobal("sessionStorage", memoryStorage());
});

afterEach(() => vi.unstubAllGlobals());

describe("OAuth round trip", () => {
  it("goes to the provider and comes back to the page sign-in was started for", () => {
    startOAuth("github", "/checkout?plan=pro");
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({ method: "POST", action: `${API_BASE}/api/auth/github/login`, fields: [] });
    expect(afterSignIn()).toBe("/checkout?plan=pro");
  });

  it("sends the CAPTCHA token in the form body, never the URL", () => {
    startOAuth("google", "/home", "tok-123");
    const form = submitted[0];
    expect(form.fields).toEqual([{ type: "hidden", name: CAPTCHA_FIELD, value: "tok-123" }]);
    expect(CAPTCHA_FIELD).toBe("cf-turnstile-response");
    expect(form.action).not.toContain("tok-123");
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
    expect(submitted).toHaveLength(1);
    expect(afterSignIn()).toBe("/home");
    expect(() => forgetAfterSignIn()).not.toThrow();
  });
});
