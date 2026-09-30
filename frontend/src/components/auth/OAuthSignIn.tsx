"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";

import { OAuthButton } from "@/components/auth/OAuthButton";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { useHydrated } from "@/hooks/useHydrated";
import { NO_CAPTCHA_YET, TURNSTILE_SITE_KEY, canStartSignIn, captchaReducer } from "@/lib/captcha";
import { startOAuth, type OAuthProvider } from "@/lib/oauth";
import { useAppStore } from "@/stores/app-store";

/** "Continue with Google / GitHub", shared by /login and /signup. With a
 * Turnstile site key configured, the CAPTCHA runs here (and only here) and
 * the buttons wait for its token; the backend checks it once. */
export function OAuthSignIn({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [captcha, dispatch] = useReducer(captchaReducer, NO_CAPTCHA_YET);
  const ready = canStartSignIn(TURNSTILE_SITE_KEY, captcha);
  // Already signed in (reached here inside the app; full page loads are
  // redirected by proxy.ts): no CAPTCHA, just go on.
  const hydrated = useHydrated();
  const { isAuthenticated, user } = useAppStore();
  const signedIn = hydrated && isAuthenticated && !!user;

  useEffect(() => {
    if (signedIn) router.replace(redirectTo);
  }, [signedIn, redirectTo, router]);

  // Back from Google/GitHub via the back button: the page comes out of the
  // back-forward cache with a spent token and a "Redirecting…" button, so
  // start it fresh.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const start = (provider: OAuthProvider) => {
    if (!ready || pending) return;
    setPending(provider);
    startOAuth(provider, redirectTo, captcha.token);
  };

  return (
    <div className="space-y-3">
      <OAuthButton provider="google" onClick={() => start("google")} loading={pending === "google"} disabled={!ready} />
      <OAuthButton provider="github" onClick={() => start("github")} loading={pending === "github"} disabled={!ready} />
      {TURNSTILE_SITE_KEY && !signedIn && (
        <>
          <TurnstileWidget
            siteKey={TURNSTILE_SITE_KEY}
            onVerify={(token) => dispatch({ type: "verified", token })}
            onExpire={() => dispatch({ type: "expired" })}
            onError={() => dispatch({ type: "failed" })}
          />
          {captcha.failed ? (
            <p role="alert" className="text-center text-xs text-red-300">
              The security check couldn&apos;t load. Turn off ad blockers for this site or refresh the page.
            </p>
          ) : (
            !ready && (
              <p role="status" className="text-center text-xs text-gray-400">
                Checking your browser…
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}
