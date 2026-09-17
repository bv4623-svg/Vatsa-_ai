"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FaqEntry } from "@/data/plans";

/** Accessible accordion: every question has a real answer in
 * data/plans.ts, so no panel can open onto an empty body. */
export function PricingFAQ({ items }: { items: FaqEntry[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-3xl divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-800 dark:border-gray-800">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.question}>
            <h3>
              <button
                type="button"
                id={`faq-trigger-${i}`}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${i}`}
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                <span className="text-base font-medium text-gray-900 dark:text-white">{item.question}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
            </h3>
            <div
              id={`faq-panel-${i}`}
              role="region"
              aria-labelledby={`faq-trigger-${i}`}
              hidden={!isOpen}
              className="pb-5 pr-8 text-sm leading-relaxed text-gray-600 dark:text-gray-400"
            >
              {item.answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}
