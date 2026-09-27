"use client";

import Link from "next/link";
import Image from "next/image";
import { VatsaMark } from "./VatsaMark";
import { useLocalYear } from "@/hooks/useLocalTime";

const PRODUCT_LINKS = [
  { label: "Pricing", href: "/pricing" },
  { label: "App", href: "/home" },
];

const COMPANY_LINKS = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

const LEGAL_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Refund Policy", href: "/refund" },
  { label: "Return Policy", href: "/return" },
  { label: "Disclaimer", href: "/disclaimer" },
];

const MODEL_LOGOS = [
  { name: "OpenAI", src: "/openai.png" },
  { name: "Claude", src: "/claude-color.png" },
  { name: "Gemini", src: "/gemini-color.png" },
  { name: "DeepSeek", src: "/deepseek-color.png" },
  { name: "Mistral", src: "/mistral-color.png" },
  { name: "Perplexity", src: "/perplexity-color.png" },
  { name: "Grok", src: "/grok.png" },
  { name: "Qwen", src: "/qwen-color.png" },
];

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</h3>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The one footer used on every marketing/legal page. Fixed 4-column
 * layout (brand / Product / Company / Legal) plus a bottom bar -- see
 * Task 2 of the legal-pages-consistency PRD. Not used on /login. */
export function PageFooter() {
  const currentYear = useLocalYear();

  return (
    <footer className="border-t border-gray-200 py-16 dark:border-gray-800">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <VatsaMark />
            <p className="mt-4 max-w-[220px] text-sm text-gray-500 dark:text-gray-400">Intelligence, orchestrated.</p>
          </div>
          <FooterCol title="Product" links={PRODUCT_LINKS} />
          <FooterCol title="Company" links={COMPANY_LINKS} />
          <FooterCol title="Legal" links={LEGAL_LINKS} />
        </div>

        <div className="mt-14 border-t border-gray-200 pt-8 dark:border-gray-800">
          <p className="text-center text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Powered by leading AI models
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8 gap-y-4">
            {MODEL_LOGOS.map((logo) => (
              <div key={logo.name} className="relative h-6 w-12 grayscale opacity-60 transition-all duration-300 hover:opacity-100 hover:grayscale-0">
                <Image src={logo.src} alt={logo.name} fill className="object-contain" sizes="48px" />
              </div>
            ))}
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-gray-400 dark:text-gray-500">
          &copy; {currentYear === null ? "" : `${currentYear} `}Vatsa AI. Intelligence, orchestrated.
        </p>
      </div>
    </footer>
  );
}
