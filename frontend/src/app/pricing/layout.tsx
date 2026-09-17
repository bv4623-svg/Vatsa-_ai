import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for Vatsa AI. Start free with 100 AI credits a month, or upgrade to Pro at $24.00/month for unlimited credits, code execution and premium model routing.",
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
