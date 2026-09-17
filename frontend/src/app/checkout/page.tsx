"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2, Lock, ShieldCheck } from "lucide-react";

import { useAppStore } from "@/stores/app-store";
import { PaymentCelebration } from "@/components/billing/PaymentCelebration";
import { PLANS, formatUsd, gstAmount, totalWithGst } from "@/lib/pricing/plans";
import { API_BASE, establishSession } from "@/lib/session";
import { getToken } from "@/lib/auth";
import type { RazorpayHandlerResponse } from "@/types/razorpay";

interface PaymentConfig {
  configured: boolean;
  missing: string[];
  webhook_configured: boolean;
  key_id: string | null;
}

type Status = "loading" | "ready" | "unconfigured" | "unknown-plan" | "paying" | "done";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const planId = params.get("plan");

  const user = useAppStore((s) => s.user);
  const setUserTier = useAppStore((s) => s.setUserTier);

  const plan = useMemo(() => PLANS.find((p) => p.id === planId && p.id !== "free"), [planId]);

  const [status, setStatus] = useState<Status>("loading");
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!plan) {
        setStatus("unknown-plan");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/payment/config`);
        if (!res.ok) throw new Error(`Config check failed (${res.status})`);
        const data: PaymentConfig = await res.json();
        if (cancelled) return;

        setConfig(data);
        setStatus(data.configured ? "ready" : "unconfigured");
        if (!data.configured) {
          console.error(
            "[checkout] Payments are not configured. Missing backend env var(s):",
            data.missing.join(", ")
          );
        }
      } catch (err) {
        if (cancelled) return;
        setError("Could not reach the payments service. Try again in a moment.");
        setStatus("unconfigured");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [plan]);

  const startPayment = useCallback(async () => {
    if (!plan || !config?.configured || !config.key_id) return;

    const token = getToken();
    if (!token) {
      router.replace(`/login?redirect=${encodeURIComponent(`/checkout?plan=${plan.id}`)}`);
      return;
    }

    setError(null);
    setStatus("paying");

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error("Could not load the payment window. Check your connection and retry.");
      }

      const orderRes = await fetch(`${API_BASE}/payment/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan_id: plan.id }),
      });
      if (!orderRes.ok) {
        const body = await orderRes.json().catch(() => null);
        throw new Error(body?.detail || `Could not start checkout (${orderRes.status}).`);
      }
      const order = await orderRes.json();

      const rzp = new window.Razorpay({
        key: config.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Vatsa AI",
        description: `${plan.name} plan`,
        order_id: order.order_id,
        prefill: {
          name: user?.full_name || user?.name || undefined,
          email: user?.email || undefined,
        },
        theme: { color: "#2563eb" },
        modal: {
          ondismiss: () => {
            setStatus("ready");
            setError("Payment cancelled. You have not been charged.");
          },
        },
        handler: async (response: RazorpayHandlerResponse) => {
          try {
            const verifyRes = await fetch(`${API_BASE}/payment/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id || order.order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const result = await verifyRes.json().catch(() => null);

            if (!verifyRes.ok || !result?.success) {
              setStatus("ready");
              setError(
                result?.message ||
                  "We could not verify that payment. If you were charged, contact support and quote your payment id."
              );
              return;
            }

            // Reflect the new tier immediately, then re-read the profile so
            // limits and usage come from the server rather than a guess.
            const newTier = result.tier === "ultra" ? "ultra" : "pro";
            setUserTier(newTier);
            const me = await fetch(`${API_BASE}/auth/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (me.ok) establishSession(await me.json(), token);

            setStatus("done");
            setCelebrate(true);
          } catch {
            setStatus("ready");
            setError("Payment verification failed to complete. Contact support before retrying.");
          }
        },
      });

      rzp.open();
    } catch (err: any) {
      setStatus("ready");
      setError(String(err?.message || "Could not start checkout."));
    }
  }, [plan, config, user, router, setUserTier]);

  if (status === "unknown-plan") {
    return (
      <Frame>
        <h1 className="text-xl font-semibold text-white">That plan doesn&apos;t exist</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Pick a plan from the pricing page to continue to checkout.
        </p>
        <Link href="/pricing" className="mt-6 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black">
          Back to pricing
        </Link>
      </Frame>
    );
  }

  if (status === "loading" || !plan) {
    return (
      <Frame>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking payment configuration…
        </div>
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-white/5" />
      </Frame>
    );
  }

  const base = plan.price;
  const gst = gstAmount(base);
  const total = totalWithGst(base);

  return (
    <>
      <Frame>
        <Link href="/pricing" className="mb-6 inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to pricing
        </Link>

        <h1 className="text-2xl font-semibold text-white">Checkout</h1>
        <p className="mt-1 text-sm text-zinc-400">{plan.name} plan — billed monthly</p>

        <dl className="mt-6 space-y-2 rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-400">{plan.name}</dt>
            <dd className="text-white">{formatUsd(base)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-400">GST (18%)</dt>
            <dd className="text-white">{formatUsd(gst)}</dd>
          </div>
          <div className="mt-2 flex justify-between border-t border-white/10 pt-3 text-base font-semibold">
            <dt className="text-white">Total due today</dt>
            <dd className="text-white">{formatUsd(total)}</dd>
          </div>
        </dl>

        {status === "unconfigured" ? (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="text-sm">
                <p className="font-semibold text-amber-300">Payment is not configured</p>
                <p className="mt-1 text-amber-200/80">
                  {error ??
                    "This server cannot take payments yet, so checkout is disabled rather than opening a window that could never complete."}
                </p>
                {config?.missing?.length ? (
                  <>
                    <p className="mt-3 text-xs text-amber-200/70">Missing backend environment variables:</p>
                    <ul className="mt-1 space-y-0.5">
                      {config.missing.map((key) => (
                        <li key={key} className="font-mono text-xs text-amber-300">{key}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              disabled
              className="mt-4 w-full cursor-not-allowed rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-zinc-400"
            >
              Pay {formatUsd(total)} — unavailable
            </button>
            <Link href="/contact" className="mt-3 block text-center text-xs text-amber-300 hover:underline">
              Contact us to complete this purchase
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={startPayment}
              disabled={status === "paying" || status === "done"}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "paying" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {status === "paying" ? "Opening secure checkout…" : `Pay ${formatUsd(total)}`}
            </button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
              <ShieldCheck className="h-3.5 w-3.5" /> Secure payment via Razorpay
            </p>
          </>
        )}

        <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-relaxed text-zinc-500">
          All sales are final — Vatsa AI operates a strict no-refund policy. Read the{" "}
          <Link href="/refund" className="underline hover:text-zinc-300">Refund Policy</Link> and{" "}
          <Link href="/terms" className="underline hover:text-zinc-300">Terms</Link> before paying.
        </p>
      </Frame>

      <PaymentCelebration open={celebrate} tier="pro" onContinue={() => router.push("/home")} />
    </>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl sm:p-8">
        {children}
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <Frame>
          <div className="h-56 animate-pulse rounded-xl bg-white/5" />
        </Frame>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}
