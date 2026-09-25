"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { AIOrb } from "@/components/auth/AIOrb";
import { OAuthButton } from "@/components/auth/OAuthButton";
import { API_BASE } from "@/config/api";
import { safeRedirect } from "@/lib/redirect";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: "Google sign-in isn't available right now. Try GitHub, or contact support.",
  github_not_configured: "GitHub sign-in isn't available right now. Try Google, or contact support.",
  NoToken: "Sign-in didn't complete. Please try again.",
  SessionExpired: "Your session expired. Please sign in again.",
  AuthFailed: "We couldn't sign you in. Please try again.",
};

function errorMessageFor(code: string | null): string | null {
  if (!code) return null;
  return OAUTH_ERROR_MESSAGES[code] || "Something went wrong signing you in. Please try again.";
}

function LoginContent() {
  const params = useSearchParams();
  const router = useRouter();
  const redirectTo = safeRedirect(params.get("redirect") || params.get("callbackUrl"), "/home");
  const [pendingProvider, setPendingProvider] = useState<"google" | "github" | null>(null);
  const error = errorMessageFor(params.get("error"));

  useEffect(() => {
    router.prefetch(redirectTo);
  }, [router, redirectTo]);

  const startOAuth = (provider: "google" | "github") => {
    setPendingProvider(provider);
    window.location.assign(`${API_BASE}/api/auth/${provider}/login`);
  };

  return (
    <main className="flex min-h-screen bg-[#05050A]">
      {/* Left: visual panel, hidden below lg */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-[58%] lg:flex-col lg:justify-between lg:p-12">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 100% at 15% 10%, rgba(99,102,241,0.35), transparent 55%), radial-gradient(100% 90% at 85% 90%, rgba(139,92,246,0.28), transparent 55%), #0A0A0F",
          }}
        />
        {/* Subtle noise texture for a premium, non-flat feel */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]" aria-hidden="true">
          <filter id="vatsa-login-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#vatsa-login-noise)" />
        </svg>

        <Link href="/" className="relative z-10 flex items-center gap-2">
          <div className="relative h-7 w-7 shrink-0">
            <Image src="/logo.png" alt="Vatsa AI" fill className="object-contain" sizes="28px" />
          </div>
          <span className="text-sm font-semibold text-white">Vatsa AI</span>
        </Link>

        <div className="relative z-10 flex flex-1 items-center justify-center">
          <AIOrb />
        </div>

        <div className="relative z-10 flex items-end justify-between gap-6">
          <div>
            <h1 className="max-w-md text-4xl font-bold leading-tight text-white lg:text-5xl">
              Unlock the power of AI
            </h1>
            <p className="mt-3 max-w-sm text-base text-gray-400">
              Chat with the smartest AI. Build faster with Vatsa AI.
            </p>
          </div>
          <span className="hidden shrink-0 text-xs text-gray-500 xl:block">Intelligence, orchestrated.</span>
        </div>
      </div>

      {/* Right: login card */}
      <div className="flex w-full flex-1 items-center justify-center bg-[#05050A] px-6 py-10 lg:w-[42%]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-[#0F0F15] p-8 shadow-2xl shadow-black/40 lg:p-10"
        >
          <div className="mb-8 flex flex-col items-center text-center">
            <Link href="/" className="mb-6 flex items-center gap-2">
              <div className="relative h-8 w-8 shrink-0">
                <Image src="/logo.png" alt="Vatsa AI" fill className="object-contain" sizes="32px" />
              </div>
              <span className="text-lg font-semibold text-white">Vatsa AI</span>
            </Link>
            <h2 className="text-2xl font-semibold text-white">Welcome back</h2>
            <p className="mt-1.5 text-sm text-gray-400">Sign in to continue to Vatsa AI</p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <OAuthButton provider="google" onClick={() => startOAuth("google")} loading={pendingProvider === "google"} />
            <OAuthButton provider="github" onClick={() => startOAuth("github")} loading={pendingProvider === "github"} />
          </div>

          <p className="mt-8 text-center text-xs leading-relaxed text-gray-500">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-gray-300">Terms</Link>
            {" "}&{" "}
            <Link href="/privacy" className="underline hover:text-gray-300">Privacy Policy</Link>.
          </p>
        </motion.div>
      </div>
    </main>
  );
}

function LoginFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05050A] px-6">
      <div className="h-[420px] w-full max-w-[420px] animate-pulse rounded-2xl border border-white/10 bg-[#0F0F15]" />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
