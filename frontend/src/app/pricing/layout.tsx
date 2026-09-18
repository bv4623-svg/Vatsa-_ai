import type { Metadata } from "next";
import { getPlan, formatPrice } from "@/data/plans";

const pro = getPlan("pro");
const business = getPlan("business");
const proPrice = pro ? formatPrice(pro.priceUSD, "USD") : "";
const businessPrice = business ? formatPrice(business.priceUSD, "USD") : "";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    `Simple, transparent pricing for Vatsa AI. Start free, or upgrade to Pro for ${proPrice}/month or Business for ${businessPrice}/month. Prices include all taxes.`,
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
