"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

interface TurnstileOptions {
  sitekey: string;
  action: string;
  theme: "auto" | "light" | "dark";
  appearance: "always" | "execute" | "interaction-only";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: TurnstileOptions) => string;
      remove: (widgetId: string) => void;
    };
  }
}

// Explicit rendering: the widget is created and removed with this component.
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Cloudflare Turnstile, used only by the Google/GitHub sign-in buttons
 * (components/auth/OAuthSignIn). Managed mode: invisible for most people
 * ("interaction-only" shows a checkbox only when Cloudflare wants one). */
export function TurnstileWidget({
  siteKey,
  onVerify,
  onExpire,
  onError,
}: {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire: () => void;
  onError: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  // The latest callbacks, without re-creating the widget when they change.
  const handlers = useRef({ onVerify, onExpire, onError });
  useEffect(() => {
    handlers.current = { onVerify, onExpire, onError };
  });

  useEffect(() => {
    const el = box.current;
    if (!scriptReady || !el || !window.turnstile) return;
    const widgetId = window.turnstile.render(el, {
      sitekey: siteKey,
      action: "login",
      theme: "auto",
      appearance: "interaction-only",
      callback: (token) => handlers.current.onVerify(token),
      "expired-callback": () => handlers.current.onExpire(),
      "error-callback": () => handlers.current.onError(),
    });
    return () => window.turnstile?.remove(widgetId);
  }, [scriptReady, siteKey]);

  return (
    <>
      <Script
        src={SCRIPT}
        strategy="lazyOnload"
        // onReady also fires when the page is visited again with the script cached.
        onReady={() => setScriptReady(true)}
        onError={() => handlers.current.onError()}
      />
      <div ref={box} data-testid="turnstile" className="flex justify-center" />
    </>
  );
}
