"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { AuthShell } from "@/components/auth/AuthShell";
import { OAuthSignIn } from "@/components/auth/OAuthSignIn";
import { safeRedirect } from "@/lib/redirect";

/** Sign-up is Google or GitHub only: the provider has already proven the
 * email address, so there is no password to set and no code to confirm
 * (the backend refuses email/password sign-up with 410). Same buttons, and
 * so the same CAPTCHA, as /login: both start the one Google/GitHub sign-in. */
function SignupFlow() {
  const params = useSearchParams();
  const plan = params.get("plan");
  // ?plan=pro|business continues to checkout; ?plan=free (or none) just
  // lands in the app -- free needs no payment step.
  const redirectTo = safeRedirect(
    params.get("redirect"),
    plan && plan !== "free" ? `/checkout?plan=${encodeURIComponent(plan)}` : "/home"
  );
  const loginHref = `/login${redirectTo !== "/home" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`;
  const planSubtitle =
    plan && plan !== "free"
      ? `You'll continue to checkout for the ${plan} plan after signing up.`
      : "Start free. No credit card required.";
  const footer = (
    <>
      Already have an account? <Link href={loginHref} className="font-medium text-emerald-400 hover:underline">Sign in</Link>
    </>
  );

  return (
    <AuthShell title="Create your account" subtitle={planSubtitle} footer={footer}>
      <OAuthSignIn redirectTo={redirectTo} />
      <p className="mt-6 text-center text-xs leading-relaxed text-zinc-400">
        By continuing, you agree to our{" "}
        <Link href="/terms" className="underline hover:text-zinc-200">Terms</Link>
        {" "}&{" "}
        <Link href="/privacy" className="underline hover:text-zinc-200">Privacy Policy</Link>.
      </p>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthShell title="Create your account">
      <div className="h-48 animate-pulse rounded-xl bg-white/5" />
    </AuthShell>}>
      <SignupFlow />
    </Suspense>
  );
}
