import { describe, expect, it } from "vitest";

import { NO_CAPTCHA_YET, canStartSignIn, captchaReducer } from "@/lib/captcha";

const KEY = "1x00000000000000000000AA"; // Cloudflare's public always-pass test site key

describe("sign-in buttons and the CAPTCHA", () => {
  it("stay off until the check hands over a token", () => {
    expect(canStartSignIn(KEY, NO_CAPTCHA_YET)).toBe(false);
    const solved = captchaReducer(NO_CAPTCHA_YET, { type: "verified", token: "tok" });
    expect(solved).toEqual({ token: "tok", failed: false });
    expect(canStartSignIn(KEY, solved)).toBe(true);
  });

  it("go off again when the token expires", () => {
    const solved = captchaReducer(NO_CAPTCHA_YET, { type: "verified", token: "tok" });
    const expired = captchaReducer(solved, { type: "expired" });
    expect(expired.token).toBeNull();
    expect(canStartSignIn(KEY, expired)).toBe(false);
  });

  it("stay off and report it when the check can't run", () => {
    const failed = captchaReducer(NO_CAPTCHA_YET, { type: "failed" });
    expect(failed).toEqual({ token: null, failed: true });
    expect(canStartSignIn(KEY, failed)).toBe(false);
    // A later success clears the error.
    expect(captchaReducer(failed, { type: "verified", token: "t2" })).toEqual({ token: "t2", failed: false });
  });

  it("are always on when no CAPTCHA is configured", () => {
    expect(canStartSignIn("", NO_CAPTCHA_YET)).toBe(true);
    expect(canStartSignIn("", captchaReducer(NO_CAPTCHA_YET, { type: "failed" }))).toBe(true);
  });
});
