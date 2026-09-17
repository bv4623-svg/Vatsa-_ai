"use client";

import Link from "next/link";

export function PricingBreadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-5 pt-6 lg:px-8">
      <ol className="flex items-center text-sm text-gray-500 dark:text-gray-400">
        <li><Link href="/" className="hover:underline">Home</Link></li>
        <li aria-hidden="true" className="mx-2">/</li>
        <li aria-current="page" className="font-medium text-gray-700 dark:text-gray-300">Pricing</li>
      </ol>
    </nav>
  );
}
