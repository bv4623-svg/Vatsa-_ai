import { ACCESS_NOTE, RATE_NOTE, formatPrice, listPrice, type Currency, type Plan } from "@/data/plans";

/** What the customer is about to pay. Both currencies are always listed
 * (USD first); the total is whichever one they chose to be charged in. */
export function CheckoutSummary({ plan, currency }: { plan: Plan; currency: Currency }) {
  return (
    <>
      <dl className="mt-6 space-y-2 rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-zinc-400">{plan.name} plan (USD)</dt>
          <dd className="text-white">{formatPrice(plan.priceUSD, "USD")}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-400">{plan.name} plan (INR)</dt>
          <dd className="text-white">{formatPrice(plan.priceINR, "INR")}</dd>
        </div>
        <div className="mt-2 flex justify-between border-t border-white/10 pt-3 text-base font-semibold">
          <dt className="text-white">Total due today</dt>
          <dd className="text-white">{formatPrice(listPrice(plan, currency), currency)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        {ACCESS_NOTE} {RATE_NOTE}
      </p>
    </>
  );
}
