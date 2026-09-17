"use client";

import { Sparkles } from "lucide-react";

export function PricingHero() {
  return (
    <section className="scroll-reveal mx-auto max-w-7xl px-5 pb-6 pt-8 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50/70 px-3 py-1 text-xs font-medium text-gray-600 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
          <Sparkles className="h-4 w-4 text-blue-400" aria-hidden="true" />
          Simple, transparent pricing
        </div>
        <h1 className="text-4xl font-bold md:text-5xl">
          Choose the plan that fits <span className="gradient-text">you</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
          Start free, upgrade anytime. No credit card required.
        </p>
        <p className="mt-3 border-b border-gray-200 pb-4 text-sm text-gray-400 dark:border-gray-800 dark:text-gray-500">
          <span className="font-semibold text-gray-600 dark:text-gray-300">Last Updated:</span> August 3, 2026
        </p>
      </div>
    </section>
  );
}
