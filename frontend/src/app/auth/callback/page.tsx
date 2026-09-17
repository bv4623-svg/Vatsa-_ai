"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { establishSession } from "@/lib/session";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  // Onboarding form state
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [onboardingError, setOnboardingError] = useState("");

  // ─── 1. On mount: handle token, fetch user, decide onboarding ───
  useEffect(() => {
    // Support both "token" and "access_token"
    const token = params.get("access_token") || params.get("token");
    const email = params.get("email");
    const fullName = params.get("full_name");
    const tier = params.get("tier");
    const profileCompletedParam = params.get("profile_completed");
    const error = params.get("error");

    // Handle OAuth error first
    if (error) {
      console.error("OAuth error:", error);
      router.replace(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!token) {
      router.replace("/login?error=NoToken");
      return;
    }

    // Save token to both localStorage and cookie (for middleware)
    localStorage.setItem("access_token", token);
    if (email) localStorage.setItem("user_email", email);
    if (fullName) localStorage.setItem("user_name", fullName);
    if (tier) localStorage.setItem("user_tier", tier);

    document.cookie = `access_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;

    const fetchUser = async () => {
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
          router.replace("/home");
        } else {
          setShowOnboarding(true);
        }
      } catch (err) {
        console.error(err);
        // Fallback: use URL param if API fails but profile_completed=true
        if (profileCompletedParam === "true") {
          router.replace("/home");
          return;
        }
        router.replace("/login?error=AuthFailed");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

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

      router.replace("/home");
    } catch (err: any) {
      setOnboardingError(
        err.message || "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

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
                  max={new Date().getFullYear()}
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