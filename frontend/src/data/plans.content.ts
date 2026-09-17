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

export const PRICING_FAQS: FaqEntry[] = [
  {
    question: "What happens after the free trial?",
    answer:
      "After the free trial you drop to the Free plan automatically. You keep your account, chats, and files. No card is charged unless you upgrade.",
  },
  {
    question: "Can I switch plans anytime?",
    answer:
      "Yes. Upgrades take effect immediately and are prorated. Downgrades apply at the end of your current billing cycle.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "Monthly plans: 7-day refund window if unused. Annual plans: 14-day refund window. See Refund Policy for details.",
  },
  {
    question: "What's included in Deep Research?",
    answer:
      "Deep Research is available on Business and Ultra. It runs multi-step web + document research and returns a cited report.",
  },
  {
    question: "How does smart routing work?",
    answer:
      "Smart routing automatically picks the best model (Claude, GPT, Gemini, DeepSeek, etc.) for each request based on task, cost, and latency.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes. Encrypted in transit and at rest. GDPR compliant. SOC2 controls. See Security page.",
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
