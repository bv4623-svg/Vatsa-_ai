"use client";

import { Suspense, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Lock, ShieldCheck } from "lucide-react";

import { PaymentCelebration } from "@/components/billing/PaymentCelebration";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { PaymentUnavailable } from "@/components/checkout/PaymentUnavailable";
import { CurrencySwitch } from "@/components/pricing/CurrencySwitch";
import { ACCESS_DAYS } from "@/config/pricing";
import { PLANS, formatPrice, listPrice, type Plan } from "@/data/plans";
import { useCurrency } from "@/hooks/useCurrency";
import { useLiveInrPrices } from "@/hooks/useLiveInrPrices";
import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl sm:p-8">
        {children}
      </div>
    </main>
  );
}

function CheckoutInner() {
  const params = useSearchParams();
  const planId = params.get("plan");
  const currencyParam = params.get("currency");

  const plan = useMemo(() => PLANS.find((p) => p.id === planId && p.id !== "free"), [planId]);
  const [currency, setCurrency] = useCurrency();

  // The actual Razorpay order amount is resolved server-side from the same
  // live rate (Backend/app/services/exchange_rate.py) -- this only makes
  // sure the price shown here, before paying, matches it exactly rather
  // than the static fixed-rate figure baked into PLANS at build time.
  const { prices: liveInrPrices, loading: loadingLiveInr } = useLiveInrPrices();
  const pricedPlan: Plan | undefined = useMemo(() => {
    if (!plan || plan.id === "free") return plan;
    const liveInr = liveInrPrices[plan.id as "pro" | "business"];
    return liveInr === undefined ? plan : { ...plan, priceINR: liveInr };
  }, [plan, liveInrPrices]);

  // A deep link such as /checkout?plan=pro&currency=INR picks the charge currency.
  useEffect(() => {
    if (currencyParam === "USD" || currencyParam === "INR") setCurrency(currencyParam);
  }, [currencyParam, setCurrency]);

  const { status, config, error, celebrate, startPayment, goHome } = useRazorpayCheckout(plan, currency);

  if (status === "unknown-plan") {
    return (
      <Frame>
        <h1 className="text-xl font-semibold text-white">That plan doesn&apos;t exist</h1>
        <p className="mt-2 text-sm text-zinc-400">Pick a plan from the pricing page to continue to checkout.</p>
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

  const amountLabel = formatPrice(listPrice(pricedPlan ?? plan, currency), currency);

  return (
    <>
      <Frame>
        <Link href="/pricing" className="mb-6 inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to pricing
        </Link>

        <h1 className="text-2xl font-semibold text-white">Checkout</h1>
        <p className="mt-1 text-sm text-zinc-400">{plan.name} plan — {ACCESS_DAYS} days of access</p>

        <div className="mt-5 flex items-center justify-between text-xs text-zinc-400">
          <span>Pay in</span>
          <CurrencySwitch />
        </div>

        <CheckoutSummary plan={pricedPlan ?? plan} currency={currency} isLoadingLiveInr={loadingLiveInr} />

        {status === "unconfigured" ? (
          <PaymentUnavailable error={error} missing={config?.missing} amountLabel={amountLabel} />
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
              {status === "paying" ? "Opening secure checkout…" : `Pay ${amountLabel}`}
            </button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
              <ShieldCheck className="h-3.5 w-3.5" /> Secure payment via Razorpay
            </p>
          </>
        )}

        <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-relaxed text-zinc-500">
          Plans have a 7-day refund window if unused. Read the{" "}
          <Link href="/refund" className="underline hover:text-zinc-300">Refund Policy</Link>,{" "}
          <Link href="/terms" className="underline hover:text-zinc-300">Terms</Link> and{" "}
          <Link href="/privacy" className="underline hover:text-zinc-300">Privacy Policy</Link> before paying.
        </p>
      </Frame>

      <PaymentCelebration open={celebrate} tier={plan.id === "business" ? "business" : "pro"} onContinue={goHome} />
    </>
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
