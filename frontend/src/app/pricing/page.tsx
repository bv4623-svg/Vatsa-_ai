"use client";

import { useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { Background } from "@/components/pricing/Background";
import { STYLES } from "@/components/pricing/pricing.styles";
import { PricingHeader } from "@/components/pricing/PricingHeader";
import { PricingBreadcrumb } from "@/components/pricing/PricingBreadcrumb";
import { PricingHero } from "@/components/pricing/PricingHero";
import { PlanGrid } from "@/components/pricing/PlanGrid";
import { ModelLogos } from "@/components/pricing/ModelLogos";
import { PricingFAQ } from "@/components/pricing/PricingFAQ";
import { TrustBadges } from "@/components/pricing/TrustBadges";
import { PricingFooter } from "@/components/pricing/PricingFooter";
import { PRICING_FAQS } from "@/data/plans";

export default function PricingPage() {
  const user = useAppStore((state) => state.user);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const userTier = useAppStore((state) => state.userTier);


  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("scroll-visible");
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
    );
    document.querySelectorAll(".scroll-reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="relative min-h-screen bg-transparent text-gray-900 dark:text-gray-100">
      <Background />

      <div className="relative z-10">
        <style>{STYLES}</style>

        <PricingHeader
          isAuthenticated={isAuthenticated}
          displayName={user?.name || user?.full_name || user?.email}
          tier={userTier}
        />

        <PricingBreadcrumb />
        <PricingHero />

        <PlanGrid
          isAuthenticated={isAuthenticated}
          userTier={userTier}
        />

        <ModelLogos />

        <section className="scroll-reveal mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <h2 className="mb-10 text-center text-3xl font-bold">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
          <PricingFAQ items={PRICING_FAQS} />
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
          <TrustBadges />
        </section>

        <PricingFooter />
      </div>
    </main>
  );
}
