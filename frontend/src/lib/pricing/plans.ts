export type BillingPeriod = "monthly" | "annual";

export interface Plan {
  id: "free" | "pro" | "business";
  name: string;
  /** Monthly price in USD, exactly as published. */
  price: number;
  /** Set only when a real published annual price exists. */
  annualPrice: number | null;
  gstNote: string | null;
  description: string;
  features: string[];
  disabledFeatures: string[];
  cta: string;
  popular: boolean;
  note: string | null;
}

/**
 * Annual billing has no published price yet. The toggle is shown but
 * disabled rather than deriving a discount from the monthly figure --
 * an invented "2 months free" would be a pricing claim we cannot honour.
 */
export const ANNUAL_BILLING_AVAILABLE = false;

export const GST_RATE = 0.18;

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    annualPrice: null,
    gstNote: null,
    description: "Basic access to get started",
    features: [
      "100 AI credits / month",
      "All core workspaces",
      "Community templates",
      "Basic AI models (GPT-3.5, Claude Instant)",
      "2 GB storage",
      "Community support",
      "Limited chat history (30 days)",
      "Standard response speed",
      "Single device session",
    ],
    disabledFeatures: ["Code execution", "Custom models", "Team collaboration"],
    cta: "Free",
    popular: false,
    note: null,
  },
  {
    id: "pro",
    name: "Pro",
    price: 24.0,
    annualPrice: null,
    gstNote: "+ 18% GST",
    description: "Unleash the full power of AI",
    features: [
      "Unlimited AI credits",
      "Premium model routing (Claude Opus 5, GPT-5.6, Gemini 3.6)",
      "Artifacts & project memory",
      "Priority support",
      "Code execution (Python, JS, SQL, etc.)",
      "Advanced analytics & insights",
      "Unlimited chat history",
      "Faster response times",
      "Multi-device sync",
      "Custom prompt templates",
      "Collaborative workspaces (coming soon)",
      "API access (beta)",
    ],
    disabledFeatures: [],
    cta: "Get Started",
    popular: true,
    note: "Secure payment via Razorpay",
  },
  {
    id: "business",
    name: "Business",
    price: 99.0,
    annualPrice: null,
    gstNote: "+ 18% GST",
    description: "Enterprise-grade AI for teams",
    features: [
      "Everything in Pro",
      "Unlimited smart routing",
      "Shared workspaces",
      "Priority support & SSO",
      "Custom model fine-tuning",
      "Team analytics dashboard",
      "Advanced security (GDPR, SOC2)",
      "Dedicated account manager",
      "On-premise deployment (optional)",
      "Custom SLAs",
      "Bulk user management",
      "Data export & backup",
    ],
    disabledFeatures: [],
    cta: "Get Started",
    popular: false,
    note: "Secure payment via Razorpay",
  },
];

export const MODEL_PARTNERS = [
  "OpenAI",
  "Claude",
  "Gemini",
  "DeepSeek",
  "Mistral",
  "Perplexity",
  "Grok",
  "Midjourney",
  "Poe",
  "Qwen",
  "Ollama",
  "Anthropic",
];

export const TRUST_BADGES = [
  "Enterprise Security",
  "99.9% Uptime",
  "GDPR Compliant",
  "24/7 Support",
];

export interface FaqEntry {
  question: string;
  answer: string;
}

export const PRICING_FAQS: FaqEntry[] = [
  {
    question: "What happens after the free trial?",
    answer:
      "Your Free plan continues with its monthly AI credits. There are no charges unless you upgrade to Pro, and your data and conversations are preserved either way.",
  },
  {
    question: "Can I switch plans anytime?",
    answer:
      "Yes. You can upgrade or downgrade at any time. Upgrading gives you immediate access to Pro features; downgrading takes effect at the end of your current billing period.",
  },
  {
    // Matches the published Refund Policy page ("Strict No Refund Policy —
    // all sales are final"). Do not restate this as a money-back guarantee.
    question: "Do you offer refunds?",
    answer:
      "No — Vatsa AI operates a strict no-refund policy and all sales are final. Start on the Free plan to try the product before you pay. The full terms are on the Refund Policy page, linked in the footer.",
  },
  {
    question: "What's included in Deep Research?",
    answer:
      "Deep Research uses multi-step orchestration to search, read, analyse and synthesise information from multiple sources. It builds a research plan, works through it step by step, and returns a cited answer.",
  },
  {
    question: "How does smart routing work?",
    answer:
      "Vatsa AI assesses the complexity of your request and routes it to a suitable model automatically — straightforward questions to fast models, harder reasoning to more capable ones — so you do not have to pick a model yourself.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Your data is encrypted in transit and at rest, and we do not train models on your conversations. See the Security and Privacy pages for the full detail, including options available to Business customers.",
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

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function gstAmount(price: number): number {
  return price * GST_RATE;
}

export function totalWithGst(price: number): number {
  return price + gstAmount(price);
}
