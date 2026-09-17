"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useMotionValue, useSpring } from "framer-motion";
import {
  Menu, Command, Sparkles, CreditCard, RefreshCw, Receipt,
  Shield, AlertTriangle, Lock, DollarSign, Ban,
  ChevronDown, ChevronUp, HelpCircle
} from "lucide-react";
import type { FAQItem } from "@/types";

// ─── Background (unchanged) ──────────────────────────────────────
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function Particles() { return null; }
function Background() { return null; }

// ─── Magnetic (unchanged) ──────────────────────────────────────────
interface MagneticProps { children: React.ReactNode; strength?: number; className?: string; }
function Magnetic({ children, strength = 0.32, className = "" }: MagneticProps) { return <div className={className}>{children}</div>; }

// ─── Model Logos ──────────────────────────────────────────────────
const modelLogos = [ /* same */ ];
function ModelLogos() { return null; }

// ─── VatsaMark ────────────────────────────────────────────────────
function VatsaMark({ compact = false }: { compact?: boolean }) { return null; }

// ─── FAQ data ─────────────────────────────────────────────────────
const faqData: FAQItem[] = [
  // Add your FAQ items here
];

// ─── Main Component ──────────────────────────────────────────────
export default function PaymentClient() {
  // Scroll reveal (unchanged)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("scroll-visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
    );
    document.querySelectorAll(".scroll-reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // FAQ state (unchanged)
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);


  return (
    <main className="relative min-h-screen bg-transparent text-gray-900 dark:text-gray-100">
      <Background />

      <div className="relative z-10">
        <style>{` ... your existing styles ... `}</style>

        {/* ─── Navigation ─── */}
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
          <div className="mx-auto flex h-[64px] max-w-7xl items-center justify-between px-5 lg:px-8">
            <VatsaMark />
            <nav className="hidden items-center gap-6 text-sm text-gray-600 dark:text-gray-400 lg:flex">
              <Link href="/" className="hover:text-gray-900 dark:hover:text-white transition-colors">Home</Link>
              <Link href="/pricing" className="hover:text-gray-900 dark:hover:text-white transition-colors">Pricing</Link>
              <Link href="/home" className="hover:text-gray-900 dark:hover:text-white transition-colors">App</Link>
            </nav>
            <div className="flex items-center gap-2">
              <button className="focus-ring hidden items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 sm:flex hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
                <Command size={13} /> K
              </button>
              <Link href="/login" className="focus-ring hidden rounded-lg px-3 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white sm:block transition-colors">
                Sign in
              </Link>
              <Magnetic strength={0.25}>
                <Link href="/signup" className="focus-ring rounded-lg bg-black dark:bg-white px-4 py-2 text-sm font-medium text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors inline-block">
                  Start building
                </Link>
              </Magnetic>
              <button className="focus-ring rounded-lg border border-gray-200 dark:border-gray-800 p-2 text-gray-600 dark:text-gray-400 lg:hidden hover:border-gray-300 dark:hover:border-gray-700 transition-colors" aria-label="Open menu">
                <Menu size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* ─── Breadcrumb ─── */}
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <Link href="/" className="hover:underline">Home</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-700 dark:text-gray-300 font-medium">Payments &amp; Billing</span>
          </div>
        </div>

        {/* ─── Hero ─── */}
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-8 pb-6 scroll-reveal">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 text-xs font-medium mb-4 backdrop-blur-sm">
              <CreditCard className="w-4 h-4 text-blue-400" />
              Secure Transactions
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">
              <span className="gradient-text">Payments</span> &amp; Billing
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mt-4 max-w-2xl mx-auto">
              Payment methods, subscription billing, taxes, chargebacks, and fraud protection.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-3 border-b border-gray-200 dark:border-gray-800 pb-4">
              <span className="font-semibold text-gray-600 dark:text-gray-300">Last Updated:</span> August 2, 2026
            </p>

            {/* Purchases happen on the pricing page, not on this policy page. */}
            <div className="mt-6 flex justify-center">
              <Link
                href="/pricing"
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3 text-lg font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-700"
              >
                <CreditCard className="h-5 w-5" /> View plans &amp; pricing
              </Link>
            </div>
          </div>
        </div>

        {/* ─── Content (policies, FAQ) unchanged ─── */}
        <div className="max-w-4xl mx-auto px-5 lg:px-8 pb-12">
          <div className="glass-card rounded-2xl p-8 md:p-12 scroll-reveal">
            {/* ... existing policy content ... */}
          </div>

          {/* Quick links, FAQ, etc. – unchanged */}
        </div>

        {/* Model Logos & Footer – unchanged */}
        <ModelLogos />
        <footer className="...">...</footer>
      </div>
    </main>
  );
}