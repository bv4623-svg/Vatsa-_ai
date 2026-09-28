"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthShell } from "@/components/auth/AuthShell";
import { SignupDetailsStep } from "@/components/auth/SignupDetailsStep";
import { establishSession } from "@/lib/session";
import { safeRedirect } from "@/lib/redirect";

function SignupFlow() {
  const router = useRouter();
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

  return (
    <SignupDetailsStep
      planSubtitle={planSubtitle}
      loginHref={loginHref}
      onRegistered={(accessToken, user) => {
        establishSession(user as any, accessToken);
        router.replace(redirectTo);
      }}
    />
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
