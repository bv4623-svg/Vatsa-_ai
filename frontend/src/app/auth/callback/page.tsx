"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { establishSession } from "@/lib/session";
import { afterSignIn, forgetAfterSignIn } from "@/lib/oauth";
import { verifyLogin2FA } from "@/services/auth";
import { useHydrated } from "@/hooks/useHydrated";
import { useLocalYear } from "@/hooks/useLocalTime";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  // Where sign-in was started for (e.g. checkout). Read once, so React's
  // double-run effects in development can't lose it.
  const [next] = useState(afterSignIn);
  const goNext = () => {
    forgetAfterSignIn();
    router.replace(next);
  };

  const [loading, setLoading] = useState(true);
  const thisYear = useLocalYear();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  // Onboarding form state
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [onboardingError, setOnboardingError] = useState("");

  // An account with 2FA on comes back with only a pending token: no session
  // exists until its code is entered below (POST /auth/2fa/verify-login).
  const pendingToken = params.get("requires_2fa") === "true" ? params.get("pending_token") : null;
  // This route is server-rendered, so the code form would be in the HTML
  // before React is attached; a code typed then is dropped (state stays
  // empty, Verify says "enter the code" and clears it). Show it once
  // interactive; the spinner covers the gap.
  const hydrated = useHydrated();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [codeAccepted, setCodeAccepted] = useState(false);

  // ─── Save the session, fetch the user, decide onboarding ───
  const finishSignIn = async (token: string) => {
    const email = params.get("email");
    const fullName = params.get("full_name");
    const tier = params.get("tier");
    const profileCompletedParam = params.get("profile_completed");

    // Save token to both localStorage and cookie (for middleware)
    localStorage.setItem("access_token", token);
    if (email) localStorage.setItem("user_email", email);
    if (fullName) localStorage.setItem("user_name", fullName);
    if (tier) localStorage.setItem("user_tier", tier);

    document.cookie = `access_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;

    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/login?error=SessionExpired");
          return;
        }
        throw new Error("Failed to fetch user");
      }

      const data = await res.json();
      setUserData(data);
      establishSession(data, token);

      // --- Check if onboarding is done ---
      // Support both flat and nested responses
      const profileCompleted =
        data.profile_completed ??
        data.user?.profile_completed ??
        (profileCompletedParam === "true");
      const birthMonthExists =
        data.birth_month ?? data.user?.birth_month ?? null;
      const isOnboardingDone = profileCompleted || birthMonthExists !== null;

      if (isOnboardingDone) {
        goNext();
      } else {
        setShowOnboarding(true);
      }
    } catch (err) {
      console.error(err);
      // Fallback: use URL param if API fails but profile_completed=true
      if (profileCompletedParam === "true") {
        goNext();
        return;
      }
      router.replace("/login?error=AuthFailed");
    } finally {
      setLoading(false);
    }
  };

  // ─── 1. On mount: handle the provider's answer ───
  useEffect(() => {
    // Support both "token" and "access_token"
    const token = params.get("access_token") || params.get("token");
    const error = params.get("error");

    // Handle OAuth error first
    if (error) {
      console.error("OAuth error:", error);
      router.replace(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (pendingToken) return; // the 2FA step below takes over

    if (!token) {
      router.replace("/login?error=NoToken");
      return;
    }

    const signIn = async () => {
      await finishSignIn(token);
    };
    signIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ─── 2FA code (authenticator app or backup code) ───
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = code.trim();
    if (entered.length < 6 || entered.length > 10) {
      setCodeError("Enter the 6-digit code from your authenticator app, or one of your backup codes.");
      return;
    }
    setVerifying(true);
    setCodeError("");
    try {
      const data = await verifyLogin2FA(pendingToken!, entered);
      setCodeAccepted(true);
      await finishSignIn(data.access_token);
    } catch (err: any) {
      setCodeError(String(err?.message || "Could not verify that code."));
    } finally {
      setVerifying(false);
    }
  };

  // ─── 2. Handle onboarding form submission ──────────────────────
  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setOnboardingError("");

    const month = parseInt(birthMonth, 10);
    const year = parseInt(birthYear, 10);
    const token = localStorage.getItem("access_token");

    if (isNaN(month) || month < 1 || month > 12) {
      setOnboardingError("Please enter a valid birth month (1–12).");
      setSubmitting(false);
      return;
    }
    if (isNaN(year) || year < 1950 || year > new Date().getFullYear()) {
      setOnboardingError(
        `Please enter a valid birth year (1950–${new Date().getFullYear()}).`
      );
      setSubmitting(false);
      return;
    }

    if (!token) {
      setOnboardingError("Session expired. Please log in again.");
      setSubmitting(false);
      router.replace("/login");
      return;
    }

    try {
      const res = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ birth_month: month, birth_year: year }),
      });

      if (!res.ok) {
        let errorDetail = "";
        try {
          const errorData = await res.json();
          errorDetail =
            errorData.detail || errorData.message || "Onboarding failed";
        } catch {
          errorDetail = `Server error (${res.status})`;
        }
        throw new Error(errorDetail);
      }

      goNext();
    } catch (err: any) {
      setOnboardingError(
        err.message || "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ─── 2FA Screen ──────────────────────────────────────────────────
  if (pendingToken && !codeAccepted && hydrated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 p-8 rounded-xl shadow-2xl">
          <h1 className="text-2xl font-bold mb-2">Two-factor authentication</h1>
          <p className="text-gray-400 mb-6">
            Enter the 6-digit code from your authenticator app, or one of your backup codes.
          </p>
          <form onSubmit={handleCodeSubmit} noValidate>
            <label htmlFor="twoFactorCode" className="block text-sm font-medium text-gray-300 mb-1">
              Authentication code
            </label>
            <input
              id="twoFactorCode"
              autoComplete="one-time-code"
              autoFocus
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
              aria-invalid={!!codeError}
              aria-describedby={codeError ? "twoFactorCode-error" : undefined}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="123456"
            />
            {codeError && (
              <p id="twoFactorCode-error" role="alert" className="mt-4 text-red-400 text-sm">{codeError}</p>
            )}
            <button
              type="submit"
              disabled={verifying}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              {verifying ? "Verifying..." : "Verify"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-400">
            <Link href="/login" className="underline hover:text-white">Back to sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  // ─── Loading Screen ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50 text-sm">Signing you in...</p>
        </div>
      </div>
    );
  }

  // ─── Onboarding Screen ──────────────────────────────────────────
  if (showOnboarding) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 p-8 rounded-xl shadow-2xl">
          <h1 className="text-3xl font-bold mb-2">Complete Your Profile</h1>
          <p className="text-gray-400 mb-6">
            We need a little more information to personalise your experience.
          </p>

          <form onSubmit={handleOnboardingSubmit}>
            <div className="space-y-4">
              {/* Birth Month */}
              <div>
                <label
                  htmlFor="birthMonth"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Birth Month (1–12)
                </label>
                <input
                  id="birthMonth"
                  type="number"
                  min="1"
                  max="12"
                  required
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 6"
                />
              </div>

              {/* Birth Year */}
              <div>
                <label
                  htmlFor="birthYear"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Birth Year
                </label>
                <input
                  id="birthYear"
                  type="number"
                  min="1950"
                  max={thisYear ?? undefined}
                  required
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 1990"
                />
              </div>
            </div>

            {onboardingError && (
              <p className="mt-4 text-red-500 text-sm">{onboardingError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              {submitting ? "Saving..." : "Complete Setup"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return null;
}

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}