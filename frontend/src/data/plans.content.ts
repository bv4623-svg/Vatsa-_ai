import { ACCESS_DAYS } from "@/config/pricing";
import { getPlan } from "./plans.data";
import { RATE_NOTE, formatPrice } from "./plans.utils";
import type { FaqEntry } from "./plans.types";

export const MODEL_PARTNERS = [
  "OpenAI", "Claude", "Gemini", "DeepSeek", "Mistral", "Perplexity",
  "Grok", "Midjourney", "Poe", "Qwen", "Ollama", "Anthropic",
];

export const TRUST_BADGES = [
  "Enterprise Security",
  "99.9% Uptime",
  "GDPR Compliant",
  "24/7 Support",
];

function priceSentence(): string {
  const pro = getPlan("pro");
  const business = getPlan("business");
  if (!pro || !business) return "";
  return (
    `Pro is ${formatPrice(pro.priceUSD, "USD")} per month and Business is ${formatPrice(business.priceUSD, "USD")} per month ` +
    `(${formatPrice(pro.priceINR, "INR")} and ${formatPrice(business.priceINR, "INR")} if you pay in INR). ${RATE_NOTE} ` +
    `Prices include all taxes -- the amount you see is the amount you pay.`
  );
}

export const PRICING_FAQS: FaqEntry[] = [
  {
    question: "Do I need a credit card to start?",
    answer:
      "No. The Free plan needs no card and no payment details. You only pay when you choose to upgrade.",
  },
  {
    question: "How much do the paid plans cost?",
    answer: priceSentence(),
  },
  {
    question: "Does my plan renew automatically?",
    answer:
      `No. Each payment gives you ${ACCESS_DAYS} days of access. When that ends your account returns to the Free plan and you keep your chats and files. Pay again whenever you want to continue.`,
  },
  {
    question: "Can I switch plans anytime?",
    answer:
      "Yes. Buying a plan takes effect immediately. Unused days on a plan you were already on are not carried over to a different plan.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "Yes: a 7-day refund window if the plan is unused. See the Refund Policy for details.",
  },
  {
    question: "How do I pay, and is it secure?",
    answer:
      "Payments are processed by Razorpay, which supports cards, UPI, netbanking and wallets where available. Your card details go straight to Razorpay -- we never see or store them.",
  },
  {
    question: "What's included in Deep Research?",
    answer:
      "Deep Research is available on Business. It runs multi-step web + document research and returns a cited report.",
  },
  {
    question: "How does smart routing work?",
    answer:
      "Smart routing automatically picks the best model (Claude, GPT, Gemini, DeepSeek, etc.) for each request based on task, cost, and latency.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes. Connections are encrypted with HTTPS, passwords are hashed, and you can export or delete your data at any time. See the Security page.",
  },
];

export const FOOTER_LINKS: { label: string; href: string }[] = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Disclaimer", href: "/disclaimer" },
  { label: "Refund Policy", href: "/refund" },
  { label: "Return Policy", href: "/return" },
  { label: "Security", href: "/security" },
  { label: "Payments", href: "/payment" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];
