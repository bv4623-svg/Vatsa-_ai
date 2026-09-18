import Link from "next/link";
import { CreditCard, Lock, Receipt, RefreshCw, ShieldCheck, AlertTriangle, Mail } from "lucide-react";

import { VatsaMark } from "@/components/pricing/VatsaMark";
import { BusinessInfo } from "@/components/business/BusinessInfo";
import { ACCESS_DAYS } from "@/config/pricing";
import { ACCESS_NOTE, PLANS, RATE_NOTE, formatBothPrices } from "@/data/plans";

const PAID_PLANS = PLANS.filter((p) => p.priceUSD > 0);

const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
  { href: "/refund", label: "Refund Policy" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

function Section({ icon: Icon, title, children }: { icon: typeof Lock; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
        <Icon className="h-6 w-6 shrink-0 text-blue-400" />
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-gray-700 dark:text-gray-300">{children}</div>
    </section>
  );
}

export default function PaymentClient() {
  return (
    <main className="relative min-h-screen bg-transparent text-gray-900 dark:text-gray-100">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/80">
        <div className="mx-auto flex h-[64px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <VatsaMark />
          <nav className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 sm:gap-6">
            <Link href="/" className="transition-colors hover:text-gray-900 dark:hover:text-white">Home</Link>
            <Link href="/pricing" className="transition-colors hover:text-gray-900 dark:hover:text-white">Pricing</Link>
            <Link href="/contact" className="transition-colors hover:text-gray-900 dark:hover:text-white">Contact</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pt-6 lg:px-8">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <Link href="/" className="hover:underline">Home</Link>
          <span className="mx-2">/</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">Payments &amp; Billing</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 pb-6 pt-8 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50/70 px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
            <CreditCard className="h-4 w-4 text-blue-400" />
            Secure payments via Razorpay
          </div>
          <h1 className="text-4xl font-bold md:text-5xl">Payments &amp; Billing</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
            What you pay, how you pay, and what happens if something goes wrong.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3 text-lg font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-700"
            >
              <CreditCard className="h-5 w-5" /> View plans &amp; pricing
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-5 pb-12 lg:px-8">
        <div className="rounded-2xl border border-gray-200 bg-white/60 p-6 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04] md:p-12">
          <Section icon={Receipt} title="1. Plans and prices">
            <p>Vatsa AI has one free plan and two paid plans. Each paid plan is a single payment:</p>
            <ul className="list-disc space-y-1 pl-6">
              {PAID_PLANS.map((plan) => (
                <li key={plan.id}>
                  <strong>{plan.name}</strong>: {formatBothPrices(plan)} for {ACCESS_DAYS} days of access
                </li>
              ))}
            </ul>
            <p>
              {ACCESS_NOTE} {RATE_NOTE} The amount shown at checkout is exactly the amount charged.
            </p>
          </Section>

          <Section icon={Lock} title="2. Payment processor">
            <p>
              All payments are processed by <strong>Razorpay</strong>. Card, UPI, netbanking and wallet details
              are entered in Razorpay&apos;s secure checkout window and go to Razorpay, not to Vatsa AI. We never
              see or store your full card number. We only receive confirmation that a payment succeeded, along
              with its payment id.
            </p>
            <p>
              The payment methods on offer are the ones enabled on our Razorpay account and can vary with the
              currency you choose and your country.
            </p>
          </Section>

          <Section icon={RefreshCw} title="3. Access period and renewal">
            <p>
              A successful payment upgrades your account immediately for {ACCESS_DAYS} days. Nothing renews
              automatically and we never charge you again without you starting a new checkout. When the period
              ends, your account returns to the Free plan, and your account and chat history are kept.
            </p>
          </Section>

          <Section icon={AlertTriangle} title="4. Failed payments and disputes">
            <p>
              If a payment fails, you are not charged and can retry from the checkout page. If money leaves your
              account but your plan does not upgrade within a few minutes, contact us with your Razorpay payment
              id and we will fix it or refund you.
            </p>
            <p>
              Please contact us before raising a chargeback with your bank so we can resolve the problem faster.
            </p>
          </Section>

          <Section icon={ShieldCheck} title="5. Refunds">
            <p>
              Refund eligibility and timing are set out in our <Link href="/refund" className="text-blue-500 hover:underline">Refund Policy</Link>.
              Approved refunds go back to the original payment method.
            </p>
          </Section>

          <Section icon={Mail} title="6. Who to contact">
            <BusinessInfo />
          </Section>
        </div>
      </div>

      <footer className="border-t border-gray-200 bg-white/60 py-6 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/60">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <VatsaMark compact />
            <p className="text-xs text-gray-400 dark:text-gray-500">© 2026 Vatsa AI. Intelligence, orchestrated.</p>
            <div className="flex flex-wrap gap-4">
              {FOOTER_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="text-[0.8rem] text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-gray-100">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
