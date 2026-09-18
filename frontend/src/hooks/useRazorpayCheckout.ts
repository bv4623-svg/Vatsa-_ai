"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAppStore } from "@/stores/app-store";
import { ACCESS_DAYS } from "@/config/pricing";
import type { Currency, Plan } from "@/data/plans";
import { API_BASE, establishSession, normalizeTier } from "@/lib/session";
import { getToken } from "@/lib/auth";
import { loadRazorpayScript } from "@/lib/razorpay";
import type { RazorpayHandlerResponse } from "@/types/razorpay";

export interface PaymentConfig {
  configured: boolean;
  missing: string[];
  webhook_configured: boolean;
  key_id: string | null;
}

export type CheckoutStatus = "loading" | "ready" | "unconfigured" | "unknown-plan" | "paying" | "done";

/** Everything between "user clicked Pay" and "account upgraded":
 * the server-side config check, order creation, the Razorpay window, and
 * signature verification. The server -- never this hook -- decides the
 * amount: only the plan id and currency are sent. */
export function useRazorpayCheckout(plan: Plan | undefined, currency: Currency) {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const setUserTier = useAppStore((s) => s.setUserTier);

  const [status, setStatus] = useState<CheckoutStatus>("loading");
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
          console.error("[checkout] Payments are not configured. Missing backend env var(s):", data.missing.join(", "));
        }
      } catch {
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
        body: JSON.stringify({ plan_id: plan.id, currency }),
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
        description: `${plan.name} plan — ${ACCESS_DAYS} days of access`,
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
          setError(null);
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
                result?.detail ||
                  result?.message ||
                  "We could not verify that payment. If you were charged, contact support and quote your payment id."
              );
              return;
            }

            // Reflect the new tier immediately, then re-read the profile so
            // limits and usage come from the server rather than a guess.
            setUserTier(normalizeTier(result.tier));
            const me = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
            if (me.ok) establishSession(await me.json(), token);

            setStatus("done");
            setCelebrate(true);
          } catch {
            setStatus("ready");
            setError("Payment verification failed to complete. Contact support before retrying.");
          }
        },
      });

      // The widget lets the customer retry inside the same window, so a
      // failure is reported without closing anything or losing the order.
      rzp.on?.("payment.failed", (payload) => {
        setError(payload.error?.description || "The payment failed. You have not been charged.");
      });

      rzp.open();
    } catch (err: unknown) {
      setStatus("ready");
      setError(err instanceof Error ? err.message : "Could not start checkout.");
    }
  }, [plan, config, user, router, setUserTier, currency]);

  return { status, config, error, celebrate, startPayment, goHome: () => router.push("/home") };
}
