import type { Metadata } from "next";
import { PLANS, formatPrice } from "@/data/plans";

const pro = PLANS.find((p) => p.id === "pro");
const proPrice = pro ? formatPrice(pro.priceUSD, "USD") : "";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    `Simple, transparent pricing for Vatsa AI. Start free, or upgrade to Pro from ${proPrice}/month. Compare the Free, Pro, Business and Ultra plans.`,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing | Vatsa AI",
    description:
      "Start free, upgrade anytime. No credit card required. Compare the Free, Pro and Business plans.",
    url: "/pricing",
    type: "website",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
