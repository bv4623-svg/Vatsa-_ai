"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthShell } from "@/components/auth/AuthShell";
import { LoginPasswordStep } from "@/components/auth/LoginPasswordStep";
import { TwoFactorStep } from "@/components/auth/TwoFactorStep";
import { establishSession } from "@/lib/session";
import { safeRedirect } from "@/lib/redirect";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = safeRedirect(params.get("redirect") || params.get("callbackUrl"), "/home");
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  useEffect(() => {
    router.prefetch(redirectTo);
  }, [router, redirectTo]);

  if (pendingToken) {
    return (
      <TwoFactorStep
        pendingToken={pendingToken}
        onBack={() => setPendingToken(null)}
        onVerified={(accessToken, user) => {
          establishSession(user as any, accessToken);
          router.replace(redirectTo);
        }}
      />
    );
  }

  return (
    <LoginPasswordStep
      redirectTo={redirectTo}
      onRequires2FA={setPendingToken}
      onSuccess={() => router.replace(redirectTo)}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell title="Sign in">
      <div className="h-48 animate-pulse rounded-xl bg-white/5" />
    </AuthShell>}>
      <LoginForm />
    </Suspense>
  );
}
