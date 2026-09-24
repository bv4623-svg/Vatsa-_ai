import { ACCESS_NOTE, RATE_NOTE, formatPrice, listPrice, type Currency, type Plan } from "@/data/plans";

interface CheckoutSummaryProps {
  plan: Plan;
  currency: Currency;
  /** True while the live USD/INR rate is still being fetched -- plan.priceINR
   * is the static fallback until then, same as the pricing page. */
  isLoadingLiveInr?: boolean;
}

/** What the customer is about to pay. Both currencies are always listed
 * (USD first); the total is whichever one they chose to be charged in.
 * The INR figure here is what Razorpay actually charges (see
 * app/checkout/page.tsx and Backend/app/services/exchange_rate.py). */
export function CheckoutSummary({ plan, currency, isLoadingLiveInr = false }: CheckoutSummaryProps) {
  const showInrSkeleton = isLoadingLiveInr && (currency === "INR" || plan.priceINR > 0);

  return (
    <>
      <dl className="mt-6 space-y-2 rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-zinc-400">{plan.name} plan (USD)</dt>
          <dd className="text-white">{formatPrice(plan.priceUSD, "USD")}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-zinc-400">{plan.name} plan (INR)</dt>
          {showInrSkeleton ? (
            <div className="h-4 w-20 animate-pulse rounded bg-white/10" aria-hidden="true" />
          ) : (
            <dd className="text-white">{formatPrice(plan.priceINR, "INR")}</dd>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-3 text-base font-semibold">
          <dt className="text-white">Total due today</dt>
          {showInrSkeleton && currency === "INR" ? (
            <div className="h-5 w-24 animate-pulse rounded bg-white/10" aria-hidden="true" />
          ) : (
            <dd className="text-white">{formatPrice(listPrice(plan, currency), currency)}</dd>
          )}
        </div>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        {ACCESS_NOTE} {RATE_NOTE}
      </p>
    </>
  );
}
