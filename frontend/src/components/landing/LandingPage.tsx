"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight, AtSign, BrainCircuit, CircleHelp, Code2, Command, FileText,
  Globe2, ImageIcon, Menu, Mic, Paperclip, Play, Plus, Send, WandSparkles,
  X, Zap, BarChart3, PenTool, Briefcase, Repeat, Search, CornerDownLeft,
  Rocket, MessageSquarePlus, Brain, LayoutGrid, Boxes, Route as RouteIcon,
  CreditCard, Info, Sparkles, Activity, AudioWaveform, Braces, Check,
  Database, Layers, ScanSearch, ShieldCheck, Trophy, GitBranch, MessageCircle,
  BookOpen, FileCode2, Briefcase as BriefcaseIcon, ChevronDown, Building2,
  BadgeCheck, Star, ArrowUp, Bot, FlaskConical, LayoutDashboard as LayoutDashboardIcon,
  User, Mail, Lock, DollarSign, TrendingUp,
  ChevronRight, FileSearch, PenLine, Cog, Mountain
} from "lucide-react";

import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { Variants } from "framer-motion";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

// ─── Import Background & Magnetic from your existing components ───
import Background from "@/components/landing/Background";
import Magnetic from "@/components/landing/Magnetic";

// ─── Utility: cn (tailwind‑merge without external deps) ───
function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ─────────────────────────────────────────────────────────────
// 1. DATA – updated pricing to match actual billing
// ─────────────────────────────────────────────────────────────

const placeholderPrompts = [
  "Build Netflix Clone",
  "Research Quantum AI",
  "Debug Python",
  "Generate React App",
  "Design Landing Page",
  "Summarize PDF",
  "Analyze CSV",
  "Create Presentation",
  "Build Drone Software",
];

const routerSteps = [
  ["Intent", "Coding + product build"],
  ["Complexity", "High · multi-file"],
  ["Memory", "3 project memories"],
  ["Context", "React · TypeScript"],
  ["Capabilities", "Code, reasoning, UI"],
  ["Cost", "Within Pro limit"],
  ["Latency", "0.8s predicted"],
  ["Availability", "4 providers healthy"],
  ["Best model", "Claude Opus 5"],
  ["Generating", "Workspace artifact"],
];

const suggestions = [
  { icon: Code2, title: "Coding", description: "Ship a feature or fix a bug", id: "coding" },
  { icon: FileText, title: "Research", description: "Synthesize reliable answers", id: "research" },
  { icon: BarChart3, title: "Data Analysis", description: "Turn rows into decisions", id: "data" },
  { icon: ImageIcon, title: "Image Generation", description: "Create a visual direction", id: "image" },
  { icon: Globe2, title: "Website Builder", description: "Design and deploy a site", id: "website" },
  { icon: PenTool, title: "Writing", description: "Draft, edit, and refine", id: "writing" },
  { icon: Briefcase, title: "Business", description: "Plan your next big move", id: "business" },
  { icon: Repeat, title: "Automation", description: "Make busywork disappear", id: "automation" },
];

type IconKey = "code" | "research" | "data" | "image" | "web" | "writing" | "business" | "automation";

interface Workspace {
  id: string;
  index: string;
  title: string;
  tagline: string;
  icon: IconKey;
  accent: string;
  backTitle: string;
  capabilities: string[];
  models?: string[];
  stack?: string[];
}

const workspaces: Workspace[] = [
  {
    id: "coding",
    index: "01",
    title: "Coding",
    tagline: "Ship a feature\nor fix a bug.",
    icon: "code",
    accent: "#8b7bff",
    backTitle: "AI Pair Programmer",
    capabilities: ["Generate Code", "Fix Bugs", "Explain Logic", "Review PRs", "Write Tests", "Documentation"],
    models: ["Claude Opus 5", "GPT-5.6", "DeepSeek V4"],
  },
  {
    id: "research",
    index: "02",
    title: "Research",
    tagline: "Synthesize reliable\nanswers.",
    icon: "research",
    accent: "#5bc8f5",
    backTitle: "Research Workspace",
    capabilities: ["Deep Research", "Source Validation", "Citations", "Web Analysis", "Summaries", "Fact Checking"],
    models: ["GPT-5.6", "Gemini 3 Pro", "Claude Opus 5"],
  },
  {
    id: "data",
    index: "03",
    title: "Data Analysis",
    tagline: "Turn rows\ninto decisions.",
    icon: "data",
    accent: "#4ade9c",
    backTitle: "Data Lab",
    capabilities: ["CSV & Excel", "SQL Queries", "Python Notebooks", "Visualization", "Forecasting", "Auto Insights"],
    stack: ["CSV", "Excel", "SQL", "Python", "Charts", "Pandas"],
  },
  {
    id: "image",
    index: "04",
    title: "Image Generation",
    tagline: "Create visual\ndirection.",
    icon: "image",
    accent: "#f58ad8",
    backTitle: "Image Studio",
    capabilities: ["Generate", "Upscale 8K", "Inpainting Edit", "Background Remove", "Product Design", "Brand Assets"],
    stack: ["Flux 2", "Imagen 4", "SDXL", "ControlNet", "LoRA", "Upscaler"],
  },
  {
    id: "web",
    index: "05",
    title: "Website Builder",
    tagline: "Design and deploy\na site.",
    icon: "web",
    accent: "#f5a45b",
    backTitle: "Website Builder",
    capabilities: ["Landing Pages", "Portfolios", "SaaS Frontends", "Dashboards", "One-click Deploy", "SEO Tuning"],
    stack: ["React", "Tailwind", "Vite", "Edge Deploy", "SSL", "Analytics"],
  },
  {
    id: "writing",
    index: "06",
    title: "Writing",
    tagline: "Draft, edit,\nand refine.",
    icon: "writing",
    accent: "#f5728b",
    backTitle: "Writing Studio",
    capabilities: ["Blogs & Essays", "Emails", "Reports", "Documentation", "Marketing Copy", "Scripts"],
    stack: ["Tone Engine", "Grammar", "Plagiarism", "Outlines", "Voice Match", "Export"],
  },
  {
    id: "business",
    index: "07",
    title: "Business",
    tagline: "Plan your\nnext move.",
    icon: "business",
    accent: "#f5cd5b",
    backTitle: "Business Workspace",
    capabilities: ["Market Research", "Strategy", "Roadmaps", "Pitch Decks", "Pricing Models", "Competitor Analysis"],
    stack: ["TAM Sizing", "SWOT", "Deck Export", "Financial Model", "KPIs", "Benchmarks"],
  },
  {
    id: "automation",
    index: "08",
    title: "Automation",
    tagline: "Make busywork\ndisappear.",
    icon: "automation",
    accent: "#5bd9f5",
    backTitle: "Automation Studio",
    capabilities: ["Autonomous Agents", "Workflows", "Zapier Bridge", "API Calls", "Scheduling", "Background Tasks"],
    stack: ["Agents", "Webhooks", "Cron", "Zapier", "REST", "Queues"],
  },
];

const modelsMarquee = [
  { name: "Claude Opus 5", provider: "Anthropic", color: "#e29a6c", speed: 82, reason: 99, code: 98, latency: "0.82s", price: "$15 / MTok", up: "99.99%", tags: ["Reasoning", "Coding", "Vision"] },
  { name: "GPT-5.6", provider: "OpenAI", color: "#7ddba8", speed: 91, reason: 95, code: 93, latency: "0.64s", price: "$12 / MTok", up: "99.98%", tags: ["Deep Research", "Agents", "Vision"] },
  { name: "Gemini 3 Pro", provider: "Google", color: "#7db8f5", speed: 95, reason: 93, code: 90, latency: "0.51s", price: "$9 / MTok", up: "99.99%", tags: ["Multimodal", "1M ctx", "Video"] },
  { name: "DeepSeek V4", provider: "DeepSeek", color: "#9f8bff", speed: 88, reason: 94, code: 96, latency: "0.58s", price: "$0.9 / MTok", up: "99.97%", tags: ["Math", "Coding", "Open"] },
  { name: "Grok 4", provider: "xAI", color: "#e8e8ee", speed: 93, reason: 91, code: 89, latency: "0.47s", price: "$6 / MTok", up: "99.95%", tags: ["Realtime", "X Data", "Vision"] },
  { name: "Qwen 3 Max", provider: "Alibaba", color: "#8b7bff", speed: 90, reason: 90, code: 92, latency: "0.55s", price: "$1.2 / MTok", up: "99.96%", tags: ["Multilingual", "Coding", "Open"] },
  { name: "Mistral Large 3", provider: "Mistral", color: "#f5a45b", speed: 94, reason: 88, code: 87, latency: "0.42s", price: "$2 / MTok", up: "99.98%", tags: ["Fast", "EU Hosted", "Open"] },
  { name: "Llama 4 Maverick", provider: "Meta", color: "#7dc9f5", speed: 96, reason: 85, code: 84, latency: "0.38s", price: "$0.4 / MTok", up: "99.99%", tags: ["Open Weights", "Fast", "Cheap"] },
];

const PROVIDER_LOGOS: Record<string, string> = {
  OpenAI: "/openai.png",
  Anthropic: "/anthropic.png",
  Google: "/gemini-color.png",
  Claude: "/claude-color.png",
  DeepSeek: "/deepseek-color.png",
  Mistral: "/mistral-color.png",
  Grok: "/grok.png",
  "xAI": "/grok.png",
  Qwen: "/qwen-color.png",
  Llama: "/ollama.png",
  Ollama: "/ollama.png",
  Meta: "/ollama.png",
  Perplexity: "/perplexity-color.png",
  Midjourney: "/midjourney.png",
  Poe: "/poe-color.png",
  Recraft: "/logo.png",
  FLUX: "/logo.png",
};

const PROVIDERS_LIST = [
  { name: "OpenAI", src: "/openai.png" },
  { name: "Anthropic", src: "/anthropic.png" },
  { name: "Claude", src: "/claude-color.png" },
  { name: "Gemini", src: "/gemini-color.png" },
  { name: "Grok", src: "/grok.png" },
  { name: "Mistral", src: "/mistral-color.png" },
  { name: "DeepSeek", src: "/deepseek-color.png" },
  { name: "Qwen", src: "/qwen-color.png" },
  { name: "Ollama", src: "/ollama.png" },
];

const TOOL_LOGOS: Record<string, string> = {
  "ChatGPT Plus": "/openai.png",
  "Claude Pro": "/claude-color.png",
  "Gemini Advanced": "/gemini-color.png",
  "Perplexity Pro": "/perplexity-color.png",
  "Midjourney": "/midjourney.png",
  "Grok Premium+": "/grok.png",
  "Poe": "/poe-color.png",
};

const TOOL_DESCS: Record<string, string> = {
  "ChatGPT Plus": "GPT-4, DALL-E, browsing, advanced data analysis",
  "Claude Pro": "200K context, reasoning, file uploads",
  "Gemini Advanced": "1M context, multimodal, YouTube integration",
  "Perplexity Pro": "Web search, citations, up-to-date answers",
  "Midjourney": "AI image generation, creative styles",
  "Grok Premium+": "Real-time X data, vision, humor",
  "Poe": "Multi-model access, chat with bots",
};

const TOOLS = [
  { name: "ChatGPT Plus", price: 20 },
  { name: "Claude Pro", price: 20 },
  { name: "Gemini Advanced", price: 20 },
  { name: "Perplexity Pro", price: 20 },
  { name: "Midjourney", price: 30 },
  { name: "Grok Premium+", price: 16 },
  { name: "Poe", price: 20 },
];
const VATSA = 19; // correct price for Vatsa Pro

const FAQS = [
  {
    q: "How does Vatsa choose which AI model to use?",
    a: "Every prompt runs through the router pipeline: intent classification, memory lookup, context assembly, and a live benchmark of 437 models on reasoning, speed, cost, and uptime. The winning model executes while a fallback stays armed. You can watch the entire decision in the router replay — nothing is hidden.",
  },
  {
    q: "Do I need separate subscriptions to OpenAI, Anthropic, or Google?",
    a: "No. One Vatsa subscription includes Claude, GPT, Gemini, DeepSeek, Grok, Mistral, Llama and every open model we support. You pay one flat price and the router spends your credits on whichever model is best for each task.",
  },
  {
    q: "What exactly is a Workspace?",
    a: "A workspace is a complete AI environment — not a chat window. The Coding workspace pairs you with a pair-programmer, repo tools and test runners; the Data Lab connects CSV/SQL/Python; the Website Builder designs and deploys. Each one assembles the right models, tools, and memory automatically.",
  },
  {
    q: "Is my data used to train models?",
    a: "Never. Your prompts, files, and memory graph are excluded from training on every plan. Business and Enterprise plans add region pinning, VPC deployment, and audit logs. You can export or delete your memory at any time.",
  },
  {
    q: "What happens if a model provider goes down?",
    a: "The health dashboard checks every provider every 30 seconds. If latency spikes or a provider degrades, the armed fallback takes over mid-stream — your response continues on the next-best model without restarting.",
  },
  {
    q: "Can my team share workspaces and memory?",
    a: "Yes. Business plans include shared team workspaces, a shared memory graph, admin controls, SSO, and per-seat analytics — so your team's context compounds instead of being scattered across personal accounts.",
  },
];

// ─── PRICING TIERS (updated to match actual billing) ────────────
const TIERS = [
  {
    name: "Free",
    monthly: 0,
    annual: 0,
    tagline: "Feel the router.",
    features: [
      "50 credits / day",
      "2 active workspaces",
      "8192-token memory",
      "Community + open models",
      "Standard routing",
    ],
  },
  {
    name: "Pro",
    monthly: 19,
    annual: 15,
    tagline: "Your full AI operating system.",
    features: [
      "2,000 credits / month",
      "All 14 workspaces",
      "All 437 frontier models",
      "Deep Think + Agent mode",
      "Persistent memory graph",
      "Priority routing & fallbacks",
    ],
    popular: true,
  },
  {
    name: "Business",
    monthly: 49,
    annual: 39,
    tagline: "For teams that ship.",
    features: [
      "Everything in Pro",
      "Shared team workspaces",
      "Admin console & SSO",
      "Usage analytics",
      "API access + webhooks",
      "Audit logs",
    ],
    perSeat: true,
  },
];

const REVIEWS = [
  { q: "I cancelled four AI subscriptions the week I found Vatsa. The router picks Claude for code and GPT for research without me thinking about it.", n: "Ananya Sharma", r: "Founding Engineer", c: "Proxima", hue: "#8b7bff" },
  { q: "Watching the routing pipeline make decisions live in front of me is the most trust-building UI I've ever used. Nothing else comes close.", n: "Marcus Feld", r: "Staff Engineer", c: "Linear Health", hue: "#5bc8f5" },
  { q: "Shipped our entire marketing site from one prompt in the Website Builder workspace. Deployment included. My team thought I hired an agency.", n: "Sofia Reyes", r: "Head of Growth", c: "Northwind", hue: "#f58ad8" },
  { q: "The memory graph is unreal. Vatsa remembered our pricing strategy from March and applied it to the new pitch deck automatically.", n: "David Okafor", r: "Founder", c: "Ledgerly", hue: "#4ade9c" },
  { q: "Deep Think mode + Claude Opus 5 routing found a race condition that three senior reviewers missed. It paid for a year of Pro in one afternoon.", n: "Lena Kowalski", r: "Platform Lead", c: "Axiom Bank", hue: "#f5cd5b" },
  { q: "Our whole data team lives in Data Lab now. CSV in, board-ready forecast out. The fallback engine saved us during the OpenAI outage.", n: "Raj Patel", r: "VP Data", c: "Mercantile", hue: "#5bd9f5" },
  { q: "It's the first AI product that feels like an operating system instead of a chat window. Linear-level polish throughout.", n: "Tom Becker", r: "Product Designer", c: "Fig & Co", hue: "#f5728b" },
  { q: "Automation Studio replaced 40 Zaps with six agents. It watches our pipeline, files PRs, and drafts release notes overnight.", n: "Yuki Tanaka", r: "DevOps Lead", c: "Kitsune", hue: "#f5a45b" },
];

const DEMOS = [
  "Build Netflix Clone",
  "Debug my JWT auth flow",
  "Research the EV charging market in 2026",
  "Design a fintech landing page",
  "Analyze Q4 churn by cohort",
];

const CHIPS = [
  { label: "Web", icon: Globe2 },
  { label: "Deep Think", icon: Brain },
  { label: "Create PRD", icon: FileText },
  { label: "Generate UI", icon: LayoutDashboardIcon },
  { label: "Search", icon: Search },
  { label: "Agent", icon: Bot },
  { label: "Research", icon: FlaskConical },
  { label: "Deploy", icon: Rocket },
];

const SUGGESTIONS = [
  "Build AI SaaS", "Generate CRM", "Find Market Opportunity", "Create Dashboard",
  "Debug Code", "Generate Research", "Create Website", "Pitch Deck", "Design UI",
  "Marketing Strategy", "Business Plan", "Mobile App", "Python Script", "Financial Analysis",
];

const REPLAY = [
  { t: "00:00.000", tag: "intent.detect", line: "software_build · app_clone (p = 0.97)", c: "#8b7bff" },
  { t: "00:00.041", tag: "memory.load", line: "3 contexts · 12,408 tokens recalled", c: "#5bc8f5" },
  { t: "00:00.086", tag: "planner.compose", line: "14 steps · artifacts: [code, ui, prd]", c: "#5bc8f5" },
  { t: "00:00.122", tag: "router.score", line: "claude-5 0.97 · gpt-5.6 0.91 · gemini-3 0.88", c: "#f5cd5b" },
  { t: "00:00.158", tag: "router.select", line: "→ claude-opus-5 (SWE-bench leader)", c: "#4ade9c" },
  { t: "00:00.174", tag: "fallback.arm", line: "gpt-5.6 standby · region iad-1", c: "#8892b0" },
  { t: "00:00.201", tag: "stream.begin", line: "TTFB 380ms · est. cost $0.041", c: "#e7e9f2" },
];

const STAGES = [
  { label: "Intent", icon: ScanSearch, msg: "Classifying intent…" },
  { label: "Memory", icon: Database, msg: "Loading memory (3 contexts)…" },
  { label: "Context", icon: Layers, msg: "Assembling context window…" },
  { label: "Tools", icon: Braces, msg: "Detecting capabilities…" },
  { label: "Ranking", icon: Trophy, msg: "Scoring 437 models…" },
  { label: "Fallback", icon: ShieldCheck, msg: "Arming fallback route…" },
  { label: "Stream", icon: AudioWaveform, msg: "Streaming response…" },
];

const HEADLINE: { w: string; grad?: boolean; br?: boolean }[] = [
  { w: "Every" }, { w: "ambitious" }, { w: "idea" }, { w: "deserves" }, { w: "an", br: true },
  { w: "operating", grad: true }, { w: "system.", grad: true },
];

const STEPS = [
  { icon: MessageSquarePlus, label: "Prompt", desc: "One natural-language request — no syntax, no model menu." },
  { icon: ScanSearch, label: "Intent", desc: "Intent classifier detects the task family in 41ms." },
  { icon: Database, label: "Memory", desc: "Relevant context retrieved from your personal memory graph." },
  { icon: Layers, label: "Context", desc: "A purpose-built context window is assembled per task." },
  { icon: Brain, label: "Planning", desc: "The planner decomposes work into steps and artifacts." },
  { icon: RouteIcon, label: "Model Selection", desc: "437 models scored on reasoning, speed, cost and uptime." },
  { icon: Zap, label: "Execution", desc: "Winning model streams; fallback route stays armed." },
  { icon: Boxes, label: "Artifacts", desc: "Code, docs, decks and data materialize in your workspace." },
  { icon: FileCode2, label: "Response", desc: "Complete, cited, review-ready work — not a paragraph." },
];

const COLS = [
  {
    title: "Product",
    links: [
      { label: "Workspaces", href: "#workspaces", icon: FileCode2 },
      { label: "Models", href: "#models", icon: Activity },
      { label: "Pricing", href: "#pricing", icon: ShieldCheck },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "#", icon: BookOpen },
      { label: "API", href: "#", icon: FileCode2 },
      { label: "Status", href: "#", icon: Activity },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Careers", href: "#", icon: BriefcaseIcon },
      { label: "Discord", href: "#", icon: MessageCircle },
      { label: "GitHub", href: "#", icon: GitBranch },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// 2. ANIMATED ICONS (same as before)
// ─────────────────────────────────────────────────────────────

type IconProps = { className?: string };

const CodeIcon: React.FC<IconProps> = ({ className = "" }) => (
  <span className={`relative inline-flex items-center justify-center ${className}`}>
    <ChevronRight className="ic-chev w-[55%] h-[55%]" strokeWidth={2.4} />
    <span className="ic-caret ml-[3px]" />
  </span>
);

const ResearchIcon: React.FC<IconProps> = ({ className = "" }) => (
  <span className={`relative inline-flex items-center justify-center overflow-hidden rounded-lg ${className}`}>
    <FileSearch className="w-[62%] h-[62%]" strokeWidth={1.9} />
    <span
      className="absolute left-[12%] right-[12%] h-[2px] rounded-full bg-current opacity-90 blur-[0.5px]"
      style={{ animation: "scan 2.6s cubic-bezier(.4,0,.2,1) infinite", top: "22%" }}
    />
  </span>
);

const DataIcon: React.FC<IconProps> = ({ className = "" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3.5 3.5v17h17" opacity="0.3" />
    <path className="ic-chart-line" d="M5 15.5 9.5 11l3.2 3 5.7-7.3 2.1 1.8" />
    <circle cx="20.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" opacity="0.9" />
  </svg>
);

const ImageIconAnimated: React.FC<IconProps> = ({ className = "" }) => (
  <span className={`relative inline-flex items-center justify-center ${className}`}>
    <Mountain className="w-[58%] h-[58%]" strokeWidth={1.9} />
    <Sparkles className="absolute -top-[2px] -right-[3px] w-[42%] h-[42%] animate-twinkle" strokeWidth={2.2} />
    <Sparkles className="absolute bottom-[0px] -left-[4px] w-[26%] h-[26%] animate-twinkle" style={{ animationDelay: "0.7s" }} strokeWidth={2.4} />
  </span>
);

const WebIcon: React.FC<IconProps> = ({ className = "" }) => (
  <span className={`relative inline-flex flex-col rounded-[5px] border-[1.6px] border-current overflow-hidden ${className}`}>
    <span className="flex gap-[2.5px] px-[3px] py-[2.5px] border-b-[1.4px] border-current/70">
      <i className="w-[2.5px] h-[2.5px] rounded-full bg-current opacity-70" />
      <i className="w-[2.5px] h-[2.5px] rounded-full bg-current opacity-70" />
      <i className="w-[2.5px] h-[2.5px] rounded-full bg-current opacity-40" />
    </span>
    <span className="flex-1 flex items-end justify-start p-[3px]">
      <span className="ic-loadbar block h-[3px] w-full rounded-full bg-current" />
    </span>
  </span>
);

const WritingIcon: React.FC<IconProps> = ({ className = "" }) => (
  <span className={`relative inline-flex flex-col items-center justify-center gap-[3px] ${className}`}>
    <PenLine className="w-[58%] h-[58%]" strokeWidth={1.9} />
    <span className="ic-scribble block h-[2.5px] w-[62%] rounded-full bg-current" />
  </span>
);

const BusinessIcon: React.FC<IconProps> = ({ className = "" }) => (
  <span className={`inline-flex items-end justify-center gap-[14%] ${className}`}>
    <i className="ic-rise-1 block w-[16%] h-[52%] rounded-[2px] bg-current" />
    <i className="ic-rise-2 block w-[16%] h-[78%] rounded-[2px] bg-current" />
    <i className="ic-rise-3 block w-[16%] h-[58%] rounded-[2px] bg-current" />
  </span>
);

const AutomationIcon: React.FC<IconProps> = ({ className = "" }) => (
  <span className={`relative inline-flex items-center justify-center ${className}`}>
    <Cog className="w-[58%] h-[58%] animate-spin-slower" strokeWidth={1.8} />
    <Cog className="absolute -bottom-[1px] -right-[2px] w-[36%] h-[36%] animate-spin-rev opacity-80" strokeWidth={2} />
  </span>
);

const workspaceIcons: Record<IconKey, React.FC<IconProps>> = {
  code: CodeIcon,
  research: ResearchIcon,
  data: DataIcon,
  image: ImageIconAnimated,
  web: WebIcon,
  writing: WritingIcon,
  business: BusinessIcon,
  automation: AutomationIcon,
};

// ─────────────────────────────────────────────────────────────
// 3. COMPONENTS (all same as before, unchanged)
// ─────────────────────────────────────────────────────────────

// ─── SectionHeading ──────────────────────────────────────
function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 26, filter: "blur(10px)" },
          show: (i: number) => ({
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            transition: { delay: i * 0.09, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
          }),
        }}
        custom={0}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="mb-5 inline-flex items-center gap-3"
      >
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-violet-400/60" />
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-violet-300/80">{eyebrow}</span>
        <span className="h-px w-8 bg-gradient-to-l from-transparent to-violet-400/60" />
      </motion.div>
      <motion.h2
        variants={{
          hidden: { opacity: 0, y: 26, filter: "blur(10px)" },
          show: (i: number) => ({
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            transition: { delay: i * 0.09, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
          }),
        }}
        custom={1}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="font-display text-4xl font-medium leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-6xl"
      >
        {title}
      </motion.h2>
      {sub && (
        <motion.p
          variants={{
            hidden: { opacity: 0, y: 26, filter: "blur(10px)" },
            show: (i: number) => ({
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              transition: { delay: i * 0.09, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
            }),
          }}
          custom={2}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-neutral-400"
        >
          {sub}
        </motion.p>
      )}
    </div>
  );
}

// ─── Magnetic ────────────────────────────────────────────
function MagneticWrapper({ children, strength = 0.32, className = "" }: { children: React.ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 14, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 200, damping: 14, mass: 0.4 });

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    x.set((e.clientX - r.left - r.width / 2) * strength);
    y.set((e.clientY - r.top - r.height / 2) * strength);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ x: sx, y: sy }}
      className={`inline-block ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ─── NetflixDemo ─────────────────────────────────────────
function NetflixDemo({ onClose }: { onClose: () => void }) {
  const movies = ["Black Mirror", "The Diplomat", "Dune", "The Bear", "The Last of Us"];
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 px-4 py-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Generated Netflix workspace preview">
      <div className="animate-slide-up relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[#3a3a3a] bg-[#090909] shadow-[0_0_0_1px_rgba(255,255,255,.05),0_24px_80px_rgba(0,0,0,.9)]">
        <div className="flex items-center justify-between border-b border-[#222] px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-xs font-bold text-black">V</span>
            <div>
              <p className="text-sm font-medium">Netflix Clone</p>
              <p className="text-[11px] text-[#777]">Generated with Claude Opus 5 · 48 seconds</p>
            </div>
          </div>
          <button onClick={onClose} className="focus-ring rounded-lg p-2 text-[#aaa] hover:bg-white/10 hover:text-white" aria-label="Close generated workspace">
            <X size={18} />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 md:grid-cols-[195px_1fr]">
          <aside className="hidden border-r border-[#222] p-3 md:block">
            <p className="px-2 py-2 text-[10px] uppercase tracking-[.16em] text-[#666]">Explorer</p>
            {["app", "components", "public", "package.json"].map((file, index) => (
              <div key={file} className={`rounded-md px-2 py-2 text-xs ${index === 0 ? "bg-white/10 text-white" : "text-[#888]"}`}>
                {index < 3 ? "› " : "  "}{file}
              </div>
            ))}
            <div className="mt-5 rounded-lg border border-[#333] bg-[#101010] p-3">
              <p className="text-xs text-white">✓ Build succeeded</p>
              <p className="mt-1 text-[10px] text-[#777]">12 files · 0 errors</p>
            </div>
          </aside>
          <main className="min-h-0 overflow-auto p-4 sm:p-6">
            <div className="overflow-hidden rounded-xl border border-[#252525] bg-black">
              <div className="flex items-center gap-1.5 border-b border-[#222] px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-[#555]"/>
                <span className="h-2 w-2 rounded-full bg-[#555]"/>
                <span className="h-2 w-2 rounded-full bg-[#555]"/>
                <span className="ml-2 text-[10px] text-[#666]">localhost:3000</span>
              </div>
              <div className="relative min-h-[330px] overflow-hidden bg-[linear-gradient(120deg,#090909,#1b1b1b_45%,#050505)] p-5 sm:p-8">
                <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,.16),transparent_65%)]"/>
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black tracking-tight text-red-500">NETFLIX</span>
                    <div className="flex gap-3 text-[9px] text-[#aaa]">
                      <span>Home</span>
                      <span>Series</span>
                      <span>My List</span>
                    </div>
                  </div>
                  <div className="mt-12 max-w-xs">
                    <p className="text-2xl font-bold tracking-tight sm:text-4xl">Stories worth staying in for.</p>
                    <p className="mt-3 text-xs leading-5 text-[#aaa]">Unlimited films, shows, and more. Built in your Vatsa coding workspace.</p>
                    <button className="mt-5 rounded-md bg-white px-4 py-2 text-xs font-semibold text-black">▶ Play preview</button>
                  </div>
                  <p className="mt-9 text-xs font-semibold">Trending now</p>
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {movies.map((movie, i) => (
                      <div key={movie} className="aspect-[2/3] rounded-md border border-white/10 p-2 text-[9px] font-medium text-white" style={{ background: `linear-gradient(${135 + i * 18}deg, #111, #${["433", "254", "333", "444", "232"][i]})` }}>
                        <span className="opacity-75">{movie}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
        <div className="flex items-center justify-between border-t border-[#222] px-5 py-3">
          <span className="text-xs text-[#888]">Artifact saved to React SaaS Platform</span>
          <div className="flex gap-2">
            <Link href="/workspace/coding" className="rounded-lg border border-[#333] px-3 py-2 text-xs text-white hover:bg-white/10">Open code</Link>
            <button onClick={onClose} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black">Keep building <ArrowRight className="ml-1 inline" size={13}/></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Background ──────────────────────────────────────────
// (Background component is already imported from @/components/landing/Background)
// We'll not redeclare it, but we need to avoid duplicate.
// In your original code you had a local Background function – we'll use the imported one.

// Since we already imported Background, we can remove the local one.
// But we need to keep the style definitions – we can put them in a style tag.

// ─── CursorGlow ──────────────────────────────────────────
function CursorGlow() {
  const [enabled, setEnabled] = useState(false);
  const x = useMotionValue(-600);
  const y = useMotionValue(-600);
  const sx = useSpring(x, { stiffness: 90, damping: 16, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 90, damping: 16, mass: 0.6 });

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    window.requestAnimationFrame(() => setEnabled(true));
    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [x, y]);

  if (!enabled) return null;

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[4] h-[520px] w-[520px] rounded-full"
      style={{
        x: sx,
        y: sy,
        marginLeft: -260,
        marginTop: -260,
        background:
          "radial-gradient(circle, rgba(139,124,246,0.09) 0%, rgba(91,200,245,0.05) 38%, transparent 68%)",
      }}
    />
  );
}

// ─── RouterDashboard ────────────────────────────────────
interface Analysis {
  intent: string;
  model: string;
  provider: string;
  accent: string;
  confidence: number;
  reason: string;
  fallback: string;
  latency: number;
  cost: string;
  tokens: string;
  hits: number;
  complexity: number;
  complexityLabel: string;
}

function hashString(s: string) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function analyze(q: string): Analysis {
  const t = q.toLowerCase();
  const h = hashString(q || "idle");
  const base = {
    latency: 340 + (h % 420),
    cost: (0.031 + ((h % 40) / 1000)).toFixed(3),
    tokens: ((h % 9200) + 1200).toLocaleString("en-US"),
    hits: (h % 4) + 1,
    complexity: Math.min(96, Math.round(18 + q.length * 1.35 + (h % 15))),
  };
  const complexityLabel = base.complexity < 40 ? "Low" : base.complexity < 70 ? "Medium" : "High";

  let pick: Omit<Analysis, keyof typeof base | "complexityLabel">;
  if (/csv|sql|data|sales|churn|forecast|revenue|cohort/.test(t))
    pick = { intent: "data analysis", model: "GPT-5.6", provider: "OpenAI", accent: "#7ddba8", confidence: 88 + (h % 9), reason: "Python + SQL co-pilot tuning", fallback: "Claude Opus 5" };
  else if (/research|market|study|report|trend|compare|analyze.*(industry|sector)/.test(t))
    pick = { intent: "deep research", model: "GPT-5.6", provider: "OpenAI", accent: "#7ddba8", confidence: 88 + (h % 9), reason: "Long-horizon web synthesis", fallback: "Gemini 3 Pro" };
  else if (/design|image|logo|ui|landing|brand|poster|thumbnail/.test(t))
    pick = { intent: "creative design", model: "Gemini 3 Pro", provider: "Google", accent: "#7db8f5", confidence: 87 + (h % 10), reason: "Best multimodal layout sense", fallback: "Claude Opus 5" };
  else if (/app|clone|debug|code|api|saas|website|deploy|script|bug|jwt|auth|build|python|function/.test(t))
    pick = { intent: "software build", model: "Claude Opus 5", provider: "Anthropic", accent: "#e29a6c", confidence: 90 + (h % 8), reason: "#1 SWE-bench Verified · 200K ctx", fallback: "GPT-5.6" };
  else if (/email|blog|write|essay|docs|copy|poem|script for/.test(t))
    pick = { intent: "long-form writing", model: "Claude Opus 5", provider: "Anthropic", accent: "#e29a6c", confidence: 89 + (h % 9), reason: "Highest editorial quality score", fallback: "GPT-5.6" };
  else pick = { intent: "general reasoning", model: "GPT-5.6", provider: "OpenAI", accent: "#7ddba8", confidence: 86 + (h % 9), reason: "Best all-round routing score", fallback: "Claude Opus 5" };

  return { ...base, complexityLabel, ...pick };
}

function Metric({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
      <div className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-neutral-500">{label}</div>
      <div className={`mt-0.5 text-[12.5px] text-neutral-100 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function RouterDashboard({ query, sendTick }: { query: string; sendTick: number }) {
  const [a, setA] = useState<Analysis>(() => analyze(""));
  const [stage, setStage] = useState(6);
  const [running, setRunning] = useState(false);
  const [jitter, setJitter] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setA(analyze(query));
      setStage(0);
      setRunning(true);
      if (timer.current) window.clearInterval(timer.current);
      let s = 0;
      timer.current = window.setInterval(() => {
        s += 1;
        setStage(s);
        if (s >= STAGES.length - 1) {
          if (timer.current) window.clearInterval(timer.current);
          setRunning(false);
        }
      }, 340);
    }, 380);
    return () => window.clearTimeout(t);
  }, [query, sendTick]);

  useEffect(() => {
    const iv = window.setInterval(() => setJitter(Math.floor(Math.random() * 34) - 17), 1500);
    return () => window.clearInterval(iv);
  }, []);

  const progress = (stage / (STAGES.length - 1)) * 100;
  const providerLogo = PROVIDER_LOGOS[a.provider] || "/logo.png";

  return (
    <div className="relative w-full">
      <div className="absolute -inset-6 rounded-[40px] bg-[radial-gradient(60%_60%_at_60%_30%,rgba(139,124,246,0.16),transparent_70%)] blur-2xl" aria-hidden="true" />

      <div className="glass relative overflow-hidden rounded-[26px] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.85)]">
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/50 to-transparent" />

        <div className="border-b border-white/[0.06] px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Activity className="h-3.5 w-3.5 text-violet-300" />
            <span className="font-display text-[13px] font-medium text-white">Live Router</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 font-mono text-[9px] tracking-[0.2em] text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            LIVE
          </span>
        </div>

        <div className="px-5 pb-5 pt-5">
          <div className="relative mb-2">
            <div className="absolute left-[4%] right-[4%] top-[17px] h-px bg-white/[0.08]" />
            <motion.div
              className="absolute left-[4%] top-[17px] h-px bg-gradient-to-r from-violet-400 to-cyan-300"
              animate={{ width: `${(progress / 100) * 92}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
            <div className="relative flex justify-between">
              {STAGES.map((s, i) => {
                const Icon = s.icon;
                const on = i <= stage;
                const active = i === stage && running;
                return (
                  <div key={s.label} className="flex flex-col items-center gap-1.5">
                    <motion.div
                      animate={{
                        scale: active ? 1.18 : 1,
                        boxShadow: on
                          ? "0 0 18px -2px rgba(139,124,246,0.55)"
                          : "0 0 0px 0px rgba(139,124,246,0)",
                      }}
                      className={`grid h-[34px] w-[34px] place-items-center rounded-full border transition-colors duration-300 ${
                        on ? "border-violet-400/50 bg-violet-500/20 text-violet-200" : "border-white/10 bg-white/[0.03] text-neutral-600"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </motion.div>
                    <span className={`font-mono text-[8px] uppercase tracking-[0.14em] ${on ? "text-neutral-300" : "text-neutral-600"}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mb-4 flex h-5 items-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={running ? stage : "done"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className={`font-mono text-[10.5px] ${running ? "text-violet-300/90" : "text-emerald-300/90"} flex items-center gap-2`}
              >
                {running ? (
                  <>
                    <span className="ic-chev inline-block h-1 w-1 rounded-full bg-violet-300" />
                    {STAGES[stage].msg}
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3" />
                    Routed to {a.model} · fallback armed
                  </>
                )}
              </motion.span>
            </AnimatePresence>
          </div>

          <motion.div
            key={a.model + a.intent}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mb-3 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-transparent p-3.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={providerLogo}
                  alt={a.provider}
                  className="h-8 w-8 rounded-full border border-white/10 object-contain p-0.5 bg-black/30"
                  loading="lazy"
                />
                <div>
                  <div className="text-[13.5px] font-medium text-white">{a.model}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9.5px] text-neutral-400">{a.provider}</span>
                    <span className="text-[9px] text-neutral-600">·</span>
                    <span className="font-mono text-[9.5px] text-neutral-400">{a.intent}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[13px] text-white">{a.confidence}%</div>
                <div className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-neutral-500">confidence</div>
              </div>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-300"
                animate={{ width: `${a.confidence}%` }}
                transition={{ type: "spring", stiffness: 60, damping: 20 }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between font-mono text-[9.5px] text-neutral-500">
              <span className="truncate pr-3 text-neutral-400">why: {a.reason}</span>
              <span className="flex shrink-0 items-center gap-1"><ShieldCheck className="h-3 w-3 text-cyan-300/80" />{a.fallback}</span>
            </div>
          </motion.div>

          <div className="grid grid-cols-3 gap-2">
            <Metric label="Latency" value={`${a.latency + jitter}ms`} />
            <Metric label="Est. cost" value={`$${a.cost}`} />
            <Metric label="Complexity" value={a.complexityLabel} mono={false} />
            <Metric label="Context" value={`${a.tokens} tok`} />
            <Metric label="Memory hits" value={`${a.hits}`} />
            <Metric label="Uptime" value="99.98%" />
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
            {[
              { n: "Anthropic", u: "99.99%" },
              { n: "OpenAI", u: "99.98%" },
              { n: "Google", u: "99.97%" },
            ].map((p) => (
              <div key={p.n} className="flex items-center gap-2 font-mono text-[9px] text-neutral-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                {p.n} <span className="text-neutral-600">{p.u}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              All Supported Providers
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {PROVIDERS_LIST.map((p) => (
                <div key={p.name} className="flex items-center gap-1.5">
                  <img
                    src={p.src}
                    alt={p.name}
                    className="h-5 w-auto max-w-[32px] object-contain brightness-90 transition-all hover:brightness-100"
                    loading="lazy"
                  />
                  <span className="text-[9px] text-neutral-400">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ModelsSection ──────────────────────────────────────
function ModelsSection() {
  return (
    <section id="models" className="relative z-10 scroll-mt-28 py-28 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Model Ecosystem"
          title={
            <>
              Every frontier model. <span className="text-gradient">One subscription.</span>
            </>
          }
          sub="Claude, GPT, Gemini, DeepSeek, Grok and 430+ more — continuously benchmarked, health-checked, and routed per task."
        />
      </div>

      <div className="group relative mt-16 overflow-hidden mask-fade-x" role="list" aria-label="Available AI models">
        <div className="flex w-max animate-marquee-fast gap-4 px-4 group-hover:[animation-play-state:paused]">
          {[...modelsMarquee, ...modelsMarquee].map((m, i) => {
            const logo = PROVIDER_LOGOS[m.provider] || null;
            return (
              <div
                role="listitem"
                key={`${m.name}-${i}`}
                className="glass w-[220px] shrink-0 rounded-[20px] p-5 transition-all duration-300 hover:-translate-y-1.5 hover:border-white/[0.16] hover:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    {logo ? (
                      <img
                        src={logo}
                        alt={m.provider}
                        className="h-8 w-8 shrink-0 rounded-full border border-white/10 object-contain p-0.5 bg-black/30"
                        loading="lazy"
                      />
                    ) : (
                      <span
                        className="h-8 w-8 shrink-0 rounded-full border border-white/10"
                        style={{ background: `radial-gradient(circle at 32% 28%, ${m.color}, ${m.color}22 72%)` }}
                      />
                    )}
                    <div>
                      <div className="text-[13.5px] font-medium text-white">{m.name}</div>
                      <div className="font-mono text-[9px] text-neutral-500">{m.provider}</div>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2 py-1 font-mono text-[8px] text-emerald-300">
                    <ShieldCheck className="h-2.5 w-2.5" /> {m.up}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {m.tags.map((t) => (
                    <span key={t} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-[3px] text-[9px] text-neutral-400">
                      {t}
                    </span>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-1 border-t border-white/[0.06] pt-3.5 text-[10px] text-neutral-400">
                  <div className="text-center">
                    <div className="font-mono text-[9px] uppercase tracking-wide text-neutral-500">Speed</div>
                    <div className="mt-0.5 font-mono text-[11px] text-white">{m.speed}%</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-[9px] uppercase tracking-wide text-neutral-500">Reason</div>
                    <div className="mt-0.5 font-mono text-[11px] text-white">{m.reason}%</div>
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-[9px] uppercase tracking-wide text-neutral-500">Code</div>
                    <div className="mt-0.5 font-mono text-[11px] text-white">{m.code}%</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3 font-mono text-[9.5px] text-neutral-500">
                  <span>TTFB <span className="text-neutral-300">{m.latency}</span></span>
                  <span className="text-neutral-300">{m.price}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-600">
        Benchmarked hourly · health-checked every 30s · +429 more models
      </p>
    </section>
  );
}

// ─── Compare ─────────────────────────────────────────────
function Compare({ onSuggestionClick }: { onSuggestionClick: (title: string) => void }) {
  // All tools selected by default
  const [on, setOn] = useState<boolean[]>([true, true, true, true, true, true, true]);
  const [hovered, setHovered] = useState<number | null>(null);

  const total = TOOLS.reduce((s, t, i) => s + (on[i] ? t.price : 0), 0);
  const springTotal = useSpring(total, { stiffness: 90, damping: 18 });
  const displayTotal = useTransform(springTotal, (v) => `$${Math.round(v)}`);
  const saved = useTransform(springTotal, (v) => `$${Math.max(0, Math.round(v) - VATSA) * 12}`);

  function ToolIcon({ name }: { name: string }) {
    const logo = TOOL_LOGOS[name];
    if (logo) {
      return (
        <img
          src={logo}
          alt={name}
          className="h-6 w-6 shrink-0 rounded-full border border-white/10 object-contain p-0.5 bg-black/30"
          loading="lazy"
        />
      );
    }
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/30 text-[10px] font-bold text-white">
        {name[0]}
      </span>
    );
  }

  return (
    <section className="relative z-10 px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Subscription Fatigue"
          title={
            <>
              Stop paying for <span className="text-gradient">five subscriptions.</span>
            </>
          }
          sub="Toggle what you pay for today. Watch what Vatsa gives back."
        />

        <div className="mx-auto mt-16 grid max-w-4xl gap-6 lg:grid-cols-[1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="glass rounded-[22px] p-4"
          >
            <div className="px-2 pb-3 font-mono text-[9.5px] uppercase tracking-[0.22em] text-neutral-500">
              Your current stack
            </div>
            {TOOLS.map((t, i) => {
              const isOn = on[i];
              const isHover = hovered === i;
              return (
                <button
                  key={t.name}
                  onClick={() => setOn((p) => p.map((v, j) => (j === i ? !v : v)))}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  aria-pressed={isOn}
                  className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-300 ${
                    isOn
                      ? "bg-white/[0.06] hover:bg-white/[0.10]"
                      : "opacity-50 hover:opacity-80 hover:bg-white/[0.03]"
                  }`}
                >
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-md border transition-all duration-200 ${
                      isOn
                        ? "border-violet-400/60 bg-violet-500/25 scale-105"
                        : "border-white/15 group-hover:border-white/30"
                    }`}
                  >
                    {isOn && <Check className="h-3 w-3 text-violet-200" strokeWidth={3} />}
                  </span>
                  <ToolIcon name={t.name} />
                  <span className="flex-1 text-[13px] text-neutral-200">{t.name}</span>
                  <span className="font-mono text-[12px] text-neutral-400">${t.price}/mo</span>
                  <AnimatePresence>
                    {isHover && isOn && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-3 py-1 text-[10px] text-neutral-300 backdrop-blur-sm border border-white/10"
                      >
                        {TOOL_DESCS[t.name] || "Full AI capabilities"}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              );
            })}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-[22px] border border-white/[0.09] bg-[#0b0d16]/90 p-6 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)]"
          >
            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/50 to-transparent" />

            <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-neutral-500">Monthly total</div>
            <div className="mt-1 flex items-baseline gap-2">
              <motion.span className="font-display text-4xl font-medium text-white">{displayTotal}</motion.span>
              <span className="text-[13px] text-neutral-500">/mo across {on.filter(Boolean).length} tools</span>
            </div>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/[0.08]" />
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-600">vs</span>
              <span className="h-px flex-1 bg-white/[0.08]" />
            </div>

            <div className="rounded-xl border border-violet-400/25 bg-violet-500/[0.08] px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13.5px] font-medium text-white">
                  <Sparkles className="h-3.5 w-3.5 text-violet-300" /> Vatsa Pro — all 437 models
                </span>
                <span className="font-mono text-[15px] text-white">${VATSA}/mo</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["Claude", "GPT", "Gemini", "DeepSeek", "Grok", "Llama", "Mistral", "Qwen"].map((m) => (
                  <span key={m} className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-neutral-400">
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between">
              <div>
                <div className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-emerald-300/90">
                  <BriefcaseIcon className="h-3.5 w-3.5" /> You save / year
                </div>
                <motion.span className="text-gradient mt-1 block font-display text-[38px] font-semibold leading-none">
                  {saved}
                </motion.span>
              </div>
              <button
                onClick={() => {
                  // scroll to pricing and open chat
                  document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
                  onSuggestionClick("Switch to Vatsa Pro");
                }}
                className="group relative overflow-hidden rounded-xl bg-white px-4 py-2.5 text-[12.5px] font-semibold text-black transition-all hover:scale-[1.04] hover:shadow-[0_8px_30px_-6px_rgba(255,255,255,0.3)]"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/[0.06] to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                Switch & Save
              </button>
            </div>

            <div className="mt-4 text-center text-[10px] text-neutral-500">
              {on.filter(Boolean).length === 0 ? (
                <span className="text-amber-300/80">Select tools to see the savings ✨</span>
              ) : (
                <span>All 437 models, unlimited chats, memory graph, and fallback routing included.</span>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ─────────────────────────────────────────────
function Pricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <section id="pricing" className="relative z-10 scroll-mt-28 px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Pricing"
          title={
            <>
              Transparent. <span className="text-gradient">Radically cheaper.</span>
            </>
          }
          sub="One workspace, every model, no seat-of-the-pants pricing. Cancel anytime."
        />

        <div className="mt-10 flex items-center justify-center gap-3">
          <div className="glass flex rounded-full p-1">
            {(["Monthly", "Annual"] as const).map((m) => {
              const isAnnual = m === "Annual";
              const active = annual === isAnnual;
              return (
                <button
                  key={m}
                  onClick={() => setAnnual(isAnnual)}
                  className={`relative rounded-full px-5 py-2 text-[12.5px] font-medium transition-colors ${active ? "text-black" : "text-neutral-400 hover:text-white"}`}
                >
                  {active && (
                    <motion.span
                      layoutId="billing-pill"
                      className="absolute inset-0 rounded-full bg-white"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  <span className="relative">{m}</span>
                </button>
              );
            })}
          </div>
          <AnimatePresence>
            {annual && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-mono text-[10px] text-emerald-300"
              >
                2 months free
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {TIERS.map((t, i) => {
            const price = annual ? t.annual : t.monthly;
            return (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className={`relative rounded-[24px] p-[1.5px] ${
                  t.popular
                    ? "bg-gradient-to-b from-violet-400/70 via-violet-400/20 to-cyan-300/40 shadow-[0_30px_80px_-25px_rgba(139,124,246,0.45)]"
                    : "bg-white/[0.07]"
                }`}
              >
                {t.popular && (
                  <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-400 to-cyan-300 px-3.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-black">
                    Most popular
                  </span>
                )}
                <div className="flex h-full flex-col rounded-[23px] bg-[#0a0c14] p-7">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-medium text-white">{t.name}</h3>
                    {t.popular && <Sparkles className="h-4 w-4 text-violet-300" />}
                  </div>
                  <p className="mt-1 text-[12.5px] text-neutral-500">{t.tagline}</p>

                  <div className="mt-5 flex h-14 items-baseline gap-1.5 overflow-hidden">
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={price}
                        initial={{ y: 18, opacity: 0, filter: "blur(6px)" }}
                        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                        exit={{ y: -18, opacity: 0, filter: "blur(6px)" }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className="font-display text-5xl font-medium tracking-tight text-white"
                      >
                        ${price}
                      </motion.span>
                    </AnimatePresence>
                    <span className="text-[12px] text-neutral-500">
                      {price === 0 ? "forever" : `/ mo${t.perSeat ? " / seat" : ""}${annual && price > 0 ? "" : ""}`}
                    </span>
                  </div>
                  <div className="h-4 text-[11px] text-emerald-300/80">
                    {annual && price > 0 ? `billed annually — save $${(t.monthly - t.annual) * 12}/yr` : ""}
                  </div>

                  <ul className="mt-5 flex flex-col gap-2.5 border-t border-white/[0.06] pt-5">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[13px] text-neutral-300">
                        <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${t.popular ? "text-violet-300" : "text-neutral-500"}`} strokeWidth={2.6} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <a
                    href="#cta"
                    className={`mt-7 flex h-11 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition-all ${
                      t.popular
                        ? "bg-white text-black hover:shadow-[0_12px_40px_-10px_rgba(139,124,246,0.7)]"
                        : "border border-white/12 text-white hover:border-white/30 hover:bg-white/[0.04]"
                    }`}
                  >
                    {price === 0 ? "Start free" : "Start building"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="glass mt-6 flex flex-col items-center justify-between gap-4 rounded-[22px] px-7 py-6 sm:flex-row"
        >
          <div className="flex items-center gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
              <Building2 className="h-5 w-5 text-cyan-300" />
            </span>
            <div>
              <div className="font-display text-[16px] font-medium text-white">Enterprise</div>
              <div className="text-[12.5px] text-neutral-500">VPC / on-prem · 99.99% SLA · dedicated support · custom model routes</div>
            </div>
          </div>
          <a href="#cta" className="flex items-center gap-2 rounded-xl border border-white/15 px-5 py-2.5 text-[13px] font-medium text-white transition-all hover:border-white/35 hover:bg-white/[0.05]">
            Talk to sales <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────
function FAQ() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number>(0);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return FAQS;
    return FAQS.filter((f) => f.q.toLowerCase().includes(t) || f.a.toLowerCase().includes(t));
  }, [q]);

  return (
    <section id="faq" className="relative z-10 scroll-mt-28 px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          eyebrow="FAQ"
          title={
            <>
              Everything, <span className="text-gradient">answered openly.</span>
            </>
          }
        />

        <div className="glass mx-auto mt-10 flex items-center gap-3 rounded-2xl px-4 py-3">
          <Search className="h-4 w-4 text-neutral-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search answers…"
            aria-label="Search FAQ"
            className="flex-1 bg-transparent text-[13.5px] text-white placeholder:text-neutral-600 focus:outline-none"
          />
          <span className="font-mono text-[10px] text-neutral-600">{list.length}/{FAQS.length}</span>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          {list.length === 0 && (
            <p className="py-10 text-center text-[13px] text-neutral-500">Nothing found — try “pricing”, “memory” or “privacy”.</p>
          )}
          {list.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className={`glass overflow-hidden rounded-2xl transition-colors ${isOpen ? "border-white/[0.14]" : ""}`}>
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className={`text-[14px] font-medium transition-colors ${isOpen ? "text-white" : "text-neutral-300"}`}>{f.q}</span>
                  <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
                    <ChevronDown className={`h-4 w-4 shrink-0 ${isOpen ? "text-violet-300" : "text-neutral-500"}`} />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="px-5 pb-5 text-[13px] leading-relaxed text-neutral-400">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── WorkspaceSection with Animated Icons and Flip Cards ──
// (same as your provided code, but we'll inline it here for completeness)
// We'll keep the same implementation from your snippet.

const finePointer =
  typeof window !== "undefined" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

function FlipCard({ w, i }: { w: Workspace; i: number }) {
  const [flipped, setFlipped] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const Icon = workspaceIcons[w.icon];

  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(my, [0, 1], [9, -9]), { stiffness: 160, damping: 16 });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-9, 9]), { stiffness: 160, damping: 16 });
  const glareX = useTransform(mx, (v) => v * 100);
  const glareY = useTransform(my, (v) => v * 100);
  const glare = useTransform(
    [glareX, glareY],
    ([x, y]) =>
      `radial-gradient(340px circle at ${x}% ${y}%, rgba(255,255,255,0.13), rgba(255,255,255,0.02) 45%, transparent 62%)`
  );

  const enter = () => {
    if (!finePointer) return;
    setHovered(true);
    timer.current = window.setTimeout(() => setFlipped(true), 150);
  };
  const leave = () => {
    if (!finePointer) return;
    if (timer.current) window.clearTimeout(timer.current);
    setHovered(false);
    setFlipped(false);
    mx.set(0.5);
    my.set(0.5);
  };
  const move = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const tap = () => {
    if (!finePointer) setFlipped((f) => !f);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setFlipped((f) => !f);
    } else if (e.key === "Escape") {
      setFlipped(false);
    }
  };

  useEffect(() => {
    if (!flipped || finePointer) return;
    const onDoc = (e: Event) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setFlipped(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [flipped]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const auraVariants: Variants = {
    idle: { opacity: [0.16, 0.34, 0.16], scale: 1, transition: { duration: 4.2, repeat: Infinity, ease: "easeInOut" } },
    hover: { opacity: 0.5, scale: 1.02, transition: { duration: 0.4 } },
    flipped: { opacity: [0.5, 0.75, 0.5], scale: 1.05, transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" } },
  };

  const face: CSSProperties = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={`${w.title} workspace card. ${flipped ? "Showing capabilities." : "Flip to explore capabilities."}`}
      onKeyDown={onKey}
      onPointerEnter={enter}
      onPointerLeave={leave}
      onPointerMove={move}
      onClick={tap}
      className="perspective-1200 w-[82vw] max-w-[340px] shrink-0 snap-center outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-4 focus-visible:ring-offset-ink sm:w-auto sm:max-w-none"
    >
      <div style={{ animation: `floaty ${5.4 + (i % 3) * 0.8}s ease-in-out ${i * 0.55}s infinite` }}>
        <motion.div
          className="preserve-3d relative"
          style={{ rotateX, rotateY, willChange: "transform" }}
          animate={{ scale: hovered || flipped ? 1.03 : 1, y: hovered || flipped ? -6 : 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
        >
          <motion.div
            variants={auraVariants}
            animate={flipped ? "flipped" : hovered ? "hover" : "idle"}
            className="absolute -inset-5 rounded-[38px] blur-2xl"
            style={{ background: `radial-gradient(60% 60% at 50% 40%, ${w.accent}44, transparent 72%)` }}
            aria-hidden="true"
          />

          <div
            className={`glow-conic pointer-events-none absolute -inset-px rounded-[29px] transition-opacity duration-300 ${hovered || flipped ? "opacity-100" : "opacity-0"}`}
            style={{ "--edge": `${w.accent}` } as CSSProperties}
            aria-hidden="true"
          />

          <motion.div
            className="preserve-3d relative aspect-[4/3]"
            style={{ willChange: "transform" }}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 250, damping: 26 }}
          >
            {/* FRONT */}
            <div
              style={face}
              className={`absolute inset-0 overflow-hidden rounded-[28px] border bg-[#0b0d16]/90 backdrop-blur-xl transition-shadow duration-500 ${
                hovered || flipped
                  ? "border-white/[0.14] shadow-[0_35px_80px_-18px_rgba(0,0,0,0.85)]"
                  : "border-white/[0.08] shadow-[0_18px_50px_-18px_rgba(0,0,0,0.7)]"
              }`}
            >
              <div className="absolute inset-x-0 top-0 h-1/2" style={{ background: `radial-gradient(90% 100% at 50% 0%, ${w.accent}1f, transparent 70%)` }} />
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
              <motion.div className="absolute inset-0" style={{ background: glare }} />

              <div className="relative flex h-full flex-col p-5">
                <div className="flex items-start justify-between">
                  <div
                    className="grid h-12 w-12 place-items-center rounded-2xl border backdrop-blur-sm"
                    style={{
                      color: w.accent,
                      background: `linear-gradient(150deg, ${w.accent}26, ${w.accent}0a)`,
                      borderColor: `${w.accent}40`,
                      boxShadow: `0 10px 30px -10px ${w.accent}66, inset 0 1px 0 rgba(255,255,255,0.08)`,
                    }}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="font-mono text-[10px] tracking-[0.2em] text-neutral-600">{w.index}</span>
                </div>

                <div className="mt-auto">
                  <h3 className="font-display text-[19px] font-medium tracking-tight text-white">{w.title}</h3>
                  <p className="mt-1 whitespace-pre-line text-[12.5px] leading-snug text-neutral-400">{w.tagline}</p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-neutral-500">
                    {finePointer ? "Hover to explore" : "Tap to flip"}
                  </span>
                  <motion.span
                    animate={{ x: hovered || flipped ? 4 : 0, color: hovered || flipped ? w.accent : "#525a75" }}
                    transition={{ duration: 0.3 }}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </motion.span>
                </div>
              </div>
            </div>

            {/* BACK */}
            <div
              style={{ ...face, transform: "rotateY(180deg)" }}
              className={`absolute inset-0 overflow-hidden rounded-[28px] border bg-[#0d101c]/95 backdrop-blur-xl transition-shadow duration-500 ${
                flipped ? "border-white/[0.14] shadow-[0_35px_80px_-18px_rgba(0,0,0,0.85)]" : "border-white/[0.08]"
              }`}
            >
              <div className="absolute inset-x-0 top-0 h-2/3" style={{ background: `radial-gradient(100% 90% at 50% 0%, ${w.accent}24, transparent 70%)` }} />
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <motion.div className="absolute inset-0" style={{ background: glare }} />

              <div className="relative flex h-full flex-col p-4">
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border" style={{ color: w.accent, background: `${w.accent}1a`, borderColor: `${w.accent}35` }}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="truncate font-display text-[14px] font-medium text-white">{w.backTitle}</span>
                  </div>
                  <span className="ml-2 flex shrink-0 items-center gap-1.5 font-mono text-[8.5px] tracking-[0.18em] text-emerald-300/90">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" /> LIVE
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-2.5 gap-y-[7px]">
                  {w.capabilities.map((c, idx) => (
                    <motion.div
                      key={c}
                      initial={false}
                      animate={{ opacity: flipped ? 1 : 0, x: flipped ? 0 : -8 }}
                      transition={{ delay: flipped ? 0.22 + idx * 0.045 : 0, duration: 0.35, ease: "easeOut" }}
                      className="flex items-center gap-1.5 text-[10.5px] text-neutral-300"
                    >
                      <Check className="h-3 w-3 shrink-0" style={{ color: w.accent }} strokeWidth={3} />
                      <span className="truncate">{c}</span>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  initial={false}
                  animate={{ opacity: flipped ? 1 : 0, y: flipped ? 0 : 8 }}
                  transition={{ delay: flipped ? 0.5 : 0, duration: 0.35 }}
                  className="mt-3"
                >
                  <div className="mb-1.5 font-mono text-[8.5px] uppercase tracking-[0.2em] text-neutral-500">
                    {w.models ? "Best models" : "Connected stack"}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(w.models ?? w.stack ?? []).map((m) => (
                      <span
                        key={m}
                        className="flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[9px] font-medium"
                        style={{ borderColor: `${w.accent}2e`, background: `${w.accent}0f`, color: "#cfd3e6" }}
                      >
                        <span className="h-1 w-1 rounded-full" style={{ background: w.accent }} />
                        {m}
                      </span>
                    ))}
                  </div>
                </motion.div>

                <motion.button
                  initial={false}
                  animate={{ opacity: flipped ? 1 : 0, y: flipped ? 0 : 10, scale: flipped ? 1 : 0.96 }}
                  transition={{ delay: flipped ? 0.62 : 0, duration: 0.35, type: "spring", stiffness: 300, damping: 22 }}
                  onClick={(e) => e.stopPropagation()}
                  tabIndex={flipped ? 0 : -1}
                  aria-label={`Launch ${w.title} workspace`}
                  className="group relative mt-auto flex h-[34px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl border text-[11.5px] font-semibold text-white transition-shadow"
                  style={{
                    borderColor: `${w.accent}4d`,
                    background: `linear-gradient(120deg, ${w.accent}30, ${w.accent}12)`,
                    boxShadow: flipped ? `0 6px 24px -8px ${w.accent}80` : "none",
                  }}
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                  Launch Workspace
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

function WorkspaceSection() {
  const scRef = useRef<HTMLDivElement>(null);
  const [dot, setDot] = useState(0);

  const onScroll = () => {
    const el = scRef.current;
    if (!el || el.children.length === 0) return;
    const cardW = (el.children[0] as HTMLElement).offsetWidth + 20;
    setDot(Math.min(workspaces.length - 1, Math.round(el.scrollLeft / cardW)));
  };

  return (
    <section id="workspaces" className="relative z-10 scroll-mt-28 px-4 py-28 sm:px-6 sm:py-36">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeading
          eyebrow="Workspaces"
          title={
            <>
              One Workspace.{" "}
              <span className="text-gradient block sm:inline">Unlimited Intelligence.</span>
            </>
          }
          sub="Whatever you're building, researching, designing, or writing — Vatsa automatically assembles the right intelligence for the job."
        />

        <div className="mt-4 flex justify-center">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-600">
            <span className="h-px w-6 bg-white/10" />
            {finePointer ? "Hover · tilt · flip every card" : "Swipe · tap a card to flip"}
            <span className="h-px w-6 bg-white/10" />
          </p>
        </div>

        <div
          ref={scRef}
          onScroll={onScroll}
          className="mt-14 flex snap-x snap-mandatory gap-5 overflow-x-auto px-[6vw] pb-4 no-scrollbar sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 lg:gap-6"
        >
          {workspaces.map((w, i) => (
            <FlipCard key={w.id} w={w} i={i} />
          ))}
        </div>

        <div className="mt-2 flex justify-center gap-1.5 sm:hidden">
          {workspaces.map((w, i) => (
            <span
              key={w.id}
              className={`h-1 rounded-full transition-all duration-300 ${i === dot ? "w-5 bg-violet-400" : "w-1 bg-white/15"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ──────────────────────────────────────
function Testimonials() {
  return (
    <section className="relative z-10 py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Loved by builders"
          title={
            <>
              Teams already <span className="text-gradient">living in Vatsa.</span>
            </>
          }
          sub="4.9 average across 2,300+ verified reviews."
        />
      </div>

      <div className="group relative mt-14 overflow-hidden mask-fade-x">
        <div className="flex w-max animate-marquee gap-4 px-4 [animation-duration:56s] group-hover:[animation-play-state:paused]">
          {[...REVIEWS, ...REVIEWS].map((r, i) => (
            <figure
              key={i}
              className="glass flex w-[330px] shrink-0 flex-col rounded-[20px] p-5 transition-colors duration-300 hover:border-white/[0.16]"
            >
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className="h-3 w-3 fill-amber-300 text-amber-300" />
                ))}
              </div>
              <blockquote className="flex-1 text-[13px] leading-relaxed text-neutral-300">“{r.q}”</blockquote>
              <figcaption className="mt-4 flex items-center gap-3 border-t border-white/[0.06] pt-4">
                <span
                  className="grid h-9 w-9 place-items-center rounded-full text-[11px] font-bold text-black"
                  style={{ background: `linear-gradient(140deg, ${r.hue}, ${r.hue}88)` }}
                >
                  {r.n.split(" ").map((p) => p[0]).join("")}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-white">
                    {r.n}
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                  </div>
                  <div className="truncate font-mono text-[9.5px] text-neutral-500">
                    {r.r} · {r.c}
                  </div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────
function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/[0.06] px-4 pb-10 pt-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.2fr_repeat(3,0.7fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 overflow-hidden rounded-[9px] border border-white/10 bg-gradient-to-br from-violet-500/25 to-cyan-400/20 flex items-center justify-center">
                <Image src="/logo.png" alt="Vatsa AI" width={28} height={28} className="h-7 w-7 object-contain" />
              </div>
              <span className="font-display text-[16px] font-semibold text-white">
                Vatsa<span className="ml-1 align-super font-mono text-[8px] tracking-[0.18em] text-violet-300/90">AI</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-[12.5px] leading-relaxed text-neutral-500">
              The operating system for intelligence. One workspace, every frontier model, complete work.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 font-mono text-[9.5px] tracking-[0.16em] text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              ALL SYSTEMS OPERATIONAL
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-600">{col.title}</div>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="group flex w-fit items-center gap-2 text-[13px] text-neutral-400 transition-colors hover:text-white">
                      <l.icon className="h-3.5 w-3.5 text-neutral-600 transition-colors group-hover:text-violet-300" />
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 sm:flex-row">
          <p className="font-mono text-[10.5px] text-neutral-600">© 2026 Vatsa AI, Inc. All rights reserved.</p>
          <div className="flex gap-5 font-mono text-[10.5px] text-neutral-600">
            <a href="#" className="transition-colors hover:text-white">Privacy</a>
            <a href="#" className="transition-colors hover:text-white">Terms</a>
            <a href="#" className="transition-colors hover:text-white">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── FinalCTA ──────────────────────────────────────────
function FinalCTA() {
  return (
    <section id="cta" className="relative z-10 scroll-mt-28 px-4 pb-28 pt-10 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] border border-white/[0.09] bg-[#0a0c16] px-6 py-20 text-center sm:py-28"
      >
        <div
          className="absolute -top-1/3 left-1/2 h-[130%] w-[130%] -translate-x-1/2 opacity-60 blur-[90px]"
          style={{
            background:
              "conic-gradient(from 120deg at 50% 50%, rgba(139,124,246,0.35), rgba(91,200,245,0.22), rgba(74,222,156,0.15), rgba(245,138,216,0.2), rgba(139,124,246,0.35))",
            animation: "aurora-c 18s ease-in-out infinite",
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[radial-gradient(65%_60%_at_50%_100%,transparent_0%,#0a0c16_88%)]" aria-hidden="true" />

        <div className="relative">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.15, type: "spring", stiffness: 120, damping: 14 }}
            className="mx-auto mb-7 grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/[0.06] backdrop-blur-md"
          >
            <Sparkles className="h-6 w-6 text-violet-200" />
          </motion.div>

          <h2 className="font-display text-4xl font-medium tracking-tight text-white sm:text-6xl">
            Ready to build with <span className="text-gradient">AI?</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-neutral-300/90">
            One prompt in. Complete work out. Your first 50 daily credits are free — forever.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <MagneticWrapper>
              <a
                href="#top"
                className="group flex h-12 items-center gap-2.5 rounded-2xl bg-white px-7 text-[14.5px] font-semibold text-black shadow-[0_20px_60px_-15px_rgba(139,124,246,0.9)] transition-shadow hover:shadow-[0_24px_70px_-12px_rgba(139,124,246,1)]"
              >
                Start Building Free
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </a>
            </MagneticWrapper>
            <MagneticWrapper strength={0.22}>
              <a
                href="#pricing"
                className="flex h-12 items-center rounded-2xl border border-white/20 bg-white/[0.04] px-7 text-[14.5px] font-medium text-white backdrop-blur-md transition-colors hover:border-white/40"
              >
                Talk to Sales
              </a>
            </MagneticWrapper>
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            <span className="flex items-center gap-2"><CreditCard className="h-3 w-3" /> No credit card</span>
            <span className="flex items-center gap-2"><ShieldCheck className="h-3 w-3 text-emerald-300" /> SOC 2 Type II</span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
              All systems operational
            </span>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// ─── Navbar ──────────────────────────────────────────────
function Navbar({ onPalette, onAuth }: { onPalette: () => void; onAuth: (mode: "signin" | "signup") => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Workspaces", href: "#workspaces" },
    { label: "Models", href: "#models" },
    { label: "Router", href: "#router" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  function Logo() {
    return (
      <a href="#top" className="group flex items-center gap-2.5">
        <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-[9px] border border-white/10 bg-gradient-to-br from-violet-500/25 via-indigo-500/15 to-cyan-400/20">
          <Image src="/logo.png" alt="Vatsa" width={20} height={20} className="h-5 w-5 object-contain" />
        </span>
        <span className="font-display text-[17px] font-semibold tracking-tight text-white">
          Vatsa<span className="ml-1 align-super font-mono text-[9px] font-medium tracking-[0.18em] text-violet-300/90">AI</span>
        </span>
      </a>
    );
  }

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div className="mx-auto max-w-7xl px-3 pt-3 sm:px-5">
        <div
          className={`flex h-14 items-center justify-between rounded-2xl px-3.5 pl-4 transition-all duration-500 ${
            scrolled ? "glass shadow-[0_18px_50px_-20px_rgba(0,0,0,0.7)]" : "border border-transparent"
          }`}
        >
          {Logo()}

          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="group relative rounded-lg px-3.5 py-2 text-[13px] font-medium text-neutral-400 transition-colors hover:text-white"
              >
                {l.label}
                <span className="absolute inset-x-3.5 -bottom-0.5 h-px origin-left scale-x-0 bg-gradient-to-r from-violet-400 to-cyan-300 transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={onPalette}
              className="hidden items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-3 pr-2 text-[12px] text-neutral-400 transition-all hover:border-white/20 hover:text-white md:flex"
              aria-label="Open command palette"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Search</span>
              <kbd className="kbd">⌘K</kbd>
            </button>
            <button
              onClick={() => onAuth("signin")}
              className="hidden rounded-xl px-3.5 py-2 text-[13px] font-medium text-neutral-300 transition-colors hover:text-white sm:block"
            >
              Sign in
            </button>
            <MagneticWrapper>
              <button
                onClick={() => onAuth("signup")}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-black shadow-[0_0_0_1px_rgba(255,255,255,0.3),0_12px_35px_-10px_rgba(139,124,246,0.6)] transition-shadow hover:shadow-[0_0_0_1px_rgba(255,255,255,0.5),0_16px_45px_-8px_rgba(139,124,246,0.85)]"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/[0.06] to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                Start Building
              </button>
            </MagneticWrapper>
            <button
              onClick={() => setOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-neutral-300 lg:hidden"
              aria-label="Toggle menu"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="glass mt-2 overflow-hidden rounded-2xl lg:hidden"
            >
              <div className="flex flex-col p-2">
                {links.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 text-[14px] text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    {l.label}
                  </a>
                ))}
                <button
                  onClick={() => {
                    setOpen(false);
                    onPalette();
                  }}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-[14px] text-neutral-300 hover:bg-white/5"
                >
                  Command Palette <kbd className="kbd">⌘K</kbd>
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    onAuth("signin");
                  }}
                  className="rounded-xl px-4 py-3 text-[14px] text-neutral-300 transition-colors hover:bg-white/5 hover:text-white text-left"
                >
                  Sign in
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    onAuth("signup");
                  }}
                  className="rounded-xl px-4 py-3 text-[14px] text-neutral-300 transition-colors hover:bg-white/5 hover:text-white text-left"
                >
                  Sign up
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}

// ─── Hero ──────────────────────────────────────────────────
function Hero({ onPalette, onAuth, onSuggestionClick }: { onPalette: () => void; onAuth: (mode: "signin" | "signup") => void; onSuggestionClick: (title: string) => void }) {
  const [query, setQuery] = useState("");
  const [userActive, setUserActive] = useState(false);
  const [sendTick, setSendTick] = useState(0);
  const [chip, setChip] = useState<string | null>(null);
  const [chipFlash, setChipFlash] = useState<string | null>(null);
  const [modelsNow, setModelsNow] = useState(437);
  const [latencyNow, setLatencyNow] = useState(38);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userActive) return;
    let cancelled = false;
    let t = 0;
    let d = 0;
    let i = 0;
    let del = false;
    const step = () => {
      if (cancelled) return;
      const full = DEMOS[d];
      if (!del) {
        i += 1;
        setQuery(full.slice(0, i));
        if (i >= full.length) {
          del = true;
          t = window.setTimeout(step, 2200);
          return;
        }
        t = window.setTimeout(step, 34 + Math.random() * 48);
      } else {
        i -= 2;
        setQuery(full.slice(0, Math.max(0, i)));
        if (i <= 0) {
          del = false;
          d = (d + 1) % DEMOS.length;
          t = window.setTimeout(step, 800);
          return;
        }
        t = window.setTimeout(step, 15);
      }
    };
    t = window.setTimeout(step, 1400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [userActive]);

  useEffect(() => {
    const iv = window.setInterval(() => {
      setModelsNow(431 + Math.floor(Math.random() * 12));
      setLatencyNow(31 + Math.floor(Math.random() * 22));
    }, 1300);
    return () => window.clearInterval(iv);
  }, []);

  useEffect(() => {
    const focusPrompt = () => {
      setUserActive(true);
      inputRef.current?.focus();
    };
    const deepThink = () => {
      setChip("Deep Think");
      setChipFlash("Deep Think");
      window.setTimeout(() => setChipFlash(null), 1200);
    };
    window.addEventListener("vatsa:focus-prompt", focusPrompt);
    window.addEventListener("vatsa:deep-think", deepThink);
    return () => {
      window.removeEventListener("vatsa:focus-prompt", focusPrompt);
      window.removeEventListener("vatsa:deep-think", deepThink);
    };
  }, []);

  const takeSuggestion = (s: string) => {
    setUserActive(true);
    setQuery(s);
    onSuggestionClick(s);
    document.querySelector("#top")?.scrollIntoView({ behavior: "smooth" });
  };

  const runRouter = () => {
    setSendTick((t) => t + 1);
  };

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return "Good night";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }

  return (
    <>
      <section id="top" className="relative z-10 px-4 pt-28 sm:px-6 sm:pt-36">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="mb-10 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10.5px] tracking-[0.08em] text-neutral-500"
          >
            <span className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-neutral-300">{modelsNow}</span> MODELS ONLINE
            </span>
            <span className="hidden sm:block">LATENCY <span className="text-neutral-300">{latencyNow}ms</span></span>
            <span>ROUTER <span className="text-emerald-300">HEALTHY</span></span>
            <span>MEMORY <span className="text-violet-300">ACTIVE</span></span>
            <span className="ml-auto hidden items-center gap-2 md:flex">
              <Sparkles className="h-3 w-3 text-violet-300/70" /> VATSA OS 2.0
            </span>
          </motion.div>

          <div className="grid items-center gap-14 lg:grid-cols-[1.12fr_0.88fr]">
            <div>
              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.5 }}
                className="mb-4 flex items-center gap-3 text-[14px] text-neutral-400"
              >
                <span className="h-px w-7 bg-gradient-to-r from-violet-400/70 to-transparent" />
                {greeting()} — your intelligent workspace is ready.
              </motion.p>

              <h1 className="font-display text-[42px] font-medium leading-[1.04] tracking-[-0.02em] text-white sm:text-6xl lg:text-[68px]">
                {HEADLINE.map((p, i) => (
                  <span key={i} className={p.br ? "block" : "inline"}>
                    <motion.span
                      className={`inline-block ${p.grad ? "text-gradient pb-1" : ""}`}
                      initial={{ opacity: 0, y: 24, filter: "blur(12px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: 0.85, delay: 0.62 + i * 0.075, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {p.w}
                    </motion.span>{" "}
                  </span>
                ))}
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, delay: 1.25 }}
                className="mt-6 max-w-lg text-[15.5px] leading-relaxed text-neutral-400"
              >
                Vatsa understands your intent, selects the right AI from{" "}
                <span className="text-neutral-200">437 frontier models</span>, and transforms one prompt
                into complete work.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.85, delay: 1.4 }}
                className="mt-9"
              >
                <motion.div
                  animate={
                    userActive
                      ? {
                          boxShadow:
                            "0 0 0 1.5px rgba(139,124,246,0.55), 0 0 70px -8px rgba(139,124,246,0.5), 0 24px 60px -22px rgba(0,0,0,0.8)",
                        }
                      : {
                          boxShadow: [
                            "0 0 0 1px rgba(255,255,255,0.08), 0 24px 60px -22px rgba(0,0,0,0.8)",
                            "0 0 0 1px rgba(139,124,246,0.28), 0 0 55px -10px rgba(139,124,246,0.4), 0 24px 60px -22px rgba(0,0,0,0.8)",
                            "0 0 0 1px rgba(255,255,255,0.08), 0 24px 60px -22px rgba(0,0,0,0.8)",
                          ],
                        }
                  }
                  transition={userActive ? { duration: 0.5 } : { duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
                  className="glass rounded-[22px] p-4"
                >
                  <div className="flex items-center gap-3">
                    <input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onFocus={() => setUserActive(true)}
                      onKeyDown={(e) => e.key === "Enter" && runRouter()}
                      placeholder={userActive ? "Ask Vatsa anything…" : ""}
                      aria-label="Prompt Vatsa"
                      className="h-11 flex-1 bg-transparent text-[15.5px] text-white placeholder:text-neutral-600 focus:outline-none"
                    />
                    <button
                      className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-neutral-400 transition-colors hover:text-white"
                      aria-label="Voice input"
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={runRouter}
                      aria-label="Run prompt"
                      className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-cyan-400 text-black shadow-[0_8px_28px_-6px_rgba(139,124,246,0.8)]"
                    >
                      <ArrowUp className="h-4.5 w-4.5" strokeWidth={2.5} />
                    </motion.button>
                  </div>

                  <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3.5">
                    {CHIPS.map((c) => {
                      const Icon = c.icon;
                      const on = chip === c.label;
                      const flash = chipFlash === c.label;
                      return (
                        <button
                          key={c.label}
                          onClick={() => setChip(on ? null : c.label)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-all duration-300 ${
                            on
                              ? "border-violet-400/50 bg-violet-500/15 text-violet-200"
                              : "border-white/[0.09] bg-white/[0.03] text-neutral-400 hover:border-white/25 hover:text-white"
                          } ${flash ? "animate-pulse" : ""}`}
                        >
                          <Icon className="h-3 w-3" />
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 pl-1 font-mono text-[10px] tracking-wide text-neutral-600">
                  <span className="flex items-center gap-1.5"><kbd className="kbd">⌘K</kbd> command palette</span>
                  <span className="flex items-center gap-1.5"><kbd className="kbd">⌘N</kbd> new chat</span>
                  <span className="flex items-center gap-1.5"><kbd className="kbd">⌘↵</kbd> deep think</span>
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 34, filter: "blur(14px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 1, delay: 1.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <RouterDashboard query={query} sendTick={sendTick} />
            </motion.div>
          </div>
        </div>
      </section>

      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.9 }}
        className="relative z-10 mt-20 border-y border-white/[0.05] py-5 mask-fade-x"
      >
        <div className="flex w-max animate-marquee gap-3">
          {[...SUGGESTIONS, ...SUGGESTIONS].map((s, i) => (
            <button
              key={i}
              onClick={() => takeSuggestion(s)}
              className="flex shrink-0 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[12px] text-neutral-400 transition-all hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
            >
              <Sparkles className="h-3 w-3 text-violet-300/70" />
              {s}
            </button>
          ))}
        </div>
      </motion.section>
    </>
  );
}

// ─── AuthModal ──────────────────────────────────────────
function AuthModal({ onClose, initialMode = "signin" }: { onClose: () => void; initialMode?: "signin" | "signup" }) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) return setError("Please fill in all fields");
    if (mode === "signup" && !name) return setError("Name is required");

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (mode === "signin") {
        alert(`Signed in as ${email}`);
        onClose();
      } else {
        alert(`Signed up as ${name}`);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl border border-[#333] bg-[#0a0a0a] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 text-[#888] hover:text-white transition">
          <X size={20} />
        </button>
        <div className="mb-6 text-center">
          <span className="inline-block rounded-full bg-white/10 p-3"><User className="h-6 w-6 text-white" /></span>
          <h2 className="mt-3 text-xl font-semibold">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          <p className="text-sm text-[#888]">{mode === "signin" ? "Sign in to continue building" : "Start building with Vatsa"}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block text-xs text-[#aaa] mb-1">Full Name</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666]" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-[#333] bg-black/50 px-3 py-2 pl-9 text-sm text-white outline-none focus:border-white/50"
                  placeholder="Your name"
                />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs text-[#aaa] mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[#333] bg-black/50 px-3 py-2 pl-9 text-sm text-white outline-none focus:border-white/50"
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#aaa] mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#333] bg-black/50 px-3 py-2 pl-9 text-sm text-white outline-none focus:border-white/50"
                placeholder="••••••••"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-black hover:bg-zinc-200 transition disabled:opacity-50"
          >
            {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[#777]">
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-white hover:underline"
          >
            {mode === "signin" ? "Sign Up" : "Sign In"}
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── ChatWidget ──────────────────────────────────────────
function ChatWidget({
  onSend,
  initialMessages = [],
  isOpen: externalOpen,
  onToggle,
}: {
  onSend: (message: string) => Promise<void>;
  initialMessages: { role: "user" | "assistant"; content: string }[];
  isOpen?: boolean;
  onToggle?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const toggle = () => {
    if (onToggle) onToggle();
    else setInternalOpen(!internalOpen);
  };

  const handleSend = async () => {
    if (!msg.trim() || loading) return;
    const m = msg.trim();
    setMsg("");
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: m }]);
    await onSend(m);
    setLoading(false);
  };

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      <button
        onClick={toggle}
        className="fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-black shadow-[0_12px_40px_-10px_rgba(139,124,246,0.7)] transition-transform hover:scale-105"
        aria-label="Toggle chat"
      >
        {open ? <X size={22} /> : <MessageSquarePlus size={22} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-24 right-5 z-30 w-[380px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d16] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
          >
            <div className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between bg-white/[0.02]">
              <span className="flex items-center gap-2 text-sm font-medium text-white">
                <span className="relative flex h-2 w-2">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Vatsa Chat
              </span>
              <span className="text-[10px] text-neutral-500">online</span>
            </div>

            <div ref={containerRef} className="max-h-[340px] min-h-[240px] overflow-y-auto p-3 space-y-2">
              {messages.length === 0 && (
                <div className="py-8 text-center text-[13px] text-neutral-500">
                  Ask me anything about Vatsa
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2 text-[13px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-violet-500/30 text-white"
                        : "bg-white/[0.06] text-neutral-300"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-xl bg-white/[0.06] px-3.5 py-2">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400" />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-white/[0.06] p-2.5 flex gap-2">
              <input
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type a message…"
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-neutral-500 focus:border-violet-400/40 focus:outline-none"
              />
              <button
                onClick={handleSend}
                disabled={loading || !msg.trim()}
                className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500 text-white transition-colors hover:bg-violet-600 disabled:opacity-40"
              >
                <Send size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── MAIN LANDING PAGE ────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const [commandOpen, setCommandOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [activeStep, setActiveStep] = useState(-1);
  const [thinking, setThinking] = useState(false);
  const [sendTick, setSendTick] = useState(0);
  const [recentChats, setRecentChats] = useState(["Continue Building SaaS", "Continue AI Router", "Review onboarding flow"]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [chatOpen, setChatOpen] = useState(false);

  const greeting = useMemo(() => {
    const now = new Date();
    if (now.getDay() === 0 || now.getDay() === 6) return "Ready to Build Something Amazing?";
    return now.getHours() < 12 ? "Good Morning" : "Good Evening";
  }, []);

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

  async function runRouter() {
    if (thinking) return;
    const task = prompt.trim() || "Build Netflix Clone";
    setPrompt(task);
    setThinking(true);
    setActiveStep(0);
    for (let step = 0; step < routerSteps.length; step += 1) {
      setActiveStep(step);
      await new Promise((resolve) =>
        window.setTimeout(resolve, step === 9 ? 720 : 330 + (step % 3) * 85)
      );
    }
    const nextRecent = [
      task.length > 31 ? `${task.slice(0, 31)}…` : task,
      ...recentChats.filter((chat) => chat !== task),
    ].slice(0, 5);
    setRecentChats(nextRecent);
    window.localStorage.setItem("vatsa-recent-chats", JSON.stringify(nextRecent));
    setThinking(false);
    setSendTick((t) => t + 1);
    setPreviewOpen(true);
  }

  useEffect(() => {
    const stored = window.localStorage.getItem("vatsa-recent-chats");
    if (stored) {
      try {
        window.setTimeout(() => setRecentChats(JSON.parse(stored) as string[]), 0);
      } catch {
        /* ignore */
      }
    }
    const interval = window.setInterval(
      () => setPlaceholderIndex((v) => (v + 1) % placeholderPrompts.length),
      2000
    );
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (event.key === "/" && !modifier && document.activeElement?.tagName !== "TEXTAREA" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        router.push("/workspace/general");
      }
      if (modifier && event.key.toLowerCase() === "l") {
        event.preventDefault();
        setPrompt("");
        inputRef.current?.focus();
      }
      if (modifier && event.key === "/") {
        event.preventDefault();
        router.push("/settings");
      }
      if (modifier && event.key === "Enter") {
        event.preventDefault();
        void runRouter();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useSuggestion = (title: string) => {
    setPrompt(`Help me with ${title.toLowerCase()}`);
    inputRef.current?.focus();
    setChatOpen(true);
  };

  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);

  const handleChatSend = async (message: string) => {
    setChatMessages((prev) => [...prev, { role: "user", content: message }]);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setChatMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `I received: "${message}". I'll help you build that! (This is a simulation)`,
      },
    ]);
  };

  const openAuth = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <>
      <Background />
      <CursorGlow />

      <style>{`
        .scroll-reveal { opacity: 0; transform: translateY(40px); transition: opacity 0.8s ease, transform 0.8s ease; }
        .scroll-visible { opacity: 1; transform: translateY(0); }
        .text-gradient { background: linear-gradient(135deg, #8b7bff, #5bc8f5, #4ade9c); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.08); }
        .mask-fade-x { mask-image: linear-gradient(to right, transparent, black 12%, black 88%, transparent); -webkit-mask-image: linear-gradient(to right, transparent, black 12%, black 88%, transparent); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .kbd { display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); padding: 0 6px; font-size: 9px; font-weight: 500; font-family: inherit; color: rgba(255,255,255,0.5); height: 18px; min-width: 18px; }
        .preserve-3d { transform-style: preserve-3d; }
        .perspective-1200 { perspective: 1200px; }
        .animate-marquee { animation: marquee 30s linear infinite; }
        .animate-marquee-fast { animation: marquee 20s linear infinite; }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-slide-up { animation: slideUp 0.4s ease-out forwards; }
        @keyframes slideUp { 0% { transform: translateY(20px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        @keyframes floaty { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        @keyframes aurora-a { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(30px, -20px) scale(1.1); } 66% { transform: translate(-20px, 10px) scale(0.9); } }
        @keyframes aurora-b { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(-25px, 15px) scale(1.05); } 66% { transform: translate(20px, -10px) scale(0.95); } }
        @keyframes aurora-c { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(15px, -25px) scale(1.08); } 66% { transform: translate(-15px, 15px) scale(0.92); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .animate-blink { animation: blink 1.2s infinite; }
        .animate-float { animation: float 6s ease-in-out infinite; }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        .btn-rgb { position: relative; border: 2px solid transparent; background-clip: padding-box; transition: all 0.3s ease; background: white; color: black; }
        .btn-rgb::before { content: ''; position: absolute; inset: -2px; border-radius: inherit; padding: 2px; background: linear-gradient(90deg, #ff0066, #00ffff, #8a2be2, #ff0066); background-size: 300% 300%; -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: rgbMove 3s linear infinite; opacity: 0; transition: opacity 0.3s ease; pointer-events: none; }
        .btn-rgb:hover::before { opacity: 1; }
        .btn-rgb:hover { transform: scale(1.03); box-shadow: 0 0 30px rgba(255, 0, 102, 0.4), 0 0 60px rgba(0, 255, 255, 0.3); }
        @keyframes rgbMove { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .rgb-border { position: relative; border: 2px solid transparent; background-clip: padding-box; transition: all 0.3s ease; }
        .rgb-border::before { content: ''; position: absolute; inset: -2px; border-radius: inherit; padding: 2px; background: linear-gradient(90deg, #ff0066, #00ffff, #8a2be2, #ff0066); background-size: 300% 300%; -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: rgbMove 3s linear infinite; opacity: 0; transition: opacity 0.3s ease; pointer-events: none; }
        .rgb-border:hover::before { opacity: 1; }
        .rgb-border:hover { transform: scale(1.02); box-shadow: 0 0 20px rgba(255, 0, 102, 0.3), 0 0 40px rgba(0, 255, 255, 0.2); }
        .glow-conic { background: conic-gradient(from var(--ang), transparent 0deg, var(--edge, rgba(139,92,246,0.9)) 60deg, transparent 130deg, transparent 200deg, var(--edge, rgba(139,92,246,0.55)) 250deg, transparent 320deg); animation: ang 3.6s linear infinite; opacity: 0; transition: opacity 0.3s ease; }
        @keyframes ang { to { --ang: 360deg; } }
        .animate-spin-slower { animation: spin 9s linear infinite; }
        .animate-spin-rev { animation: spin 8s linear infinite reverse; }
        .animate-twinkle { animation: twinkle 2.4s ease-in-out infinite; }
        @keyframes twinkle { 0%, 100% { opacity: 0.25; transform: scale(0.72) rotate(-6deg); } 50% { opacity: 1; transform: scale(1.12) rotate(8deg); } }
        .ic-chev { display: inline-block; animation: caret-bounce 1.4s ease-in-out infinite; }
        .ic-caret { width: 5px; height: 11px; border-radius: 1px; background: currentColor; animation: blink 1.1s steps(2, start) infinite; display: inline-block; }
        .ic-chart-line { stroke-dasharray: 30; animation: chart-draw 2.8s ease-in-out infinite; }
        .ic-loadbar { transform-origin: left; animation: loadbar 2.2s ease-in-out infinite; }
        .ic-scribble { transform-origin: left; animation: scribble 2.4s ease-in-out infinite; }
        .ic-rise-1 { transform-origin: bottom; animation: rise-1 2.2s ease-in-out infinite; }
        .ic-rise-2 { transform-origin: bottom; animation: rise-2 2.2s ease-in-out infinite; }
        .ic-rise-3 { transform-origin: bottom; animation: rise-3 2.2s ease-in-out infinite; }
        @keyframes caret-bounce { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(2.5px); } }
        @keyframes chart-draw { 0% { stroke-dashoffset: 30; opacity: 0.6; } 55% { stroke-dashoffset: 0; opacity: 1; } 82% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: -30; opacity: 0.3; } }
        @keyframes loadbar { 0% { transform: scaleX(0); opacity: 1; } 70% { transform: scaleX(1); opacity: 1; } 100% { transform: scaleX(1); opacity: 0.25; } }
        @keyframes scribble { 0% { transform: scaleX(0); opacity: 1; } 60% { transform: scaleX(1); opacity: 1; } 100% { transform: scaleX(1); opacity: 0; } }
        @keyframes rise-1 { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
        @keyframes rise-2 { 0%, 100% { transform: scaleY(0.6); } 50% { transform: scaleY(0.28); } }
        @keyframes rise-3 { 0%, 100% { transform: scaleY(0.85); } 50% { transform: scaleY(0.45); } }
      `}</style>

      <Navbar onPalette={() => setCommandOpen(true)} onAuth={openAuth} />

      <Hero onPalette={() => setCommandOpen(true)} onAuth={openAuth} onSuggestionClick={(title) => { setPrompt(title); setChatOpen(true); }} />

      {/* Suggestions with premium glass styling */}
      <section className="relative z-10 mx-auto max-w-7xl px-5 py-20 lg:px-8 scroll-reveal">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs uppercase tracking-[.18em] text-[#666]">Start anywhere</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-.045em] text-white">What will you bring to life?</h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[#888]">One workspace. The right intelligence for the work in front of you.</p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {suggestions.map(({ icon: Icon, title, description }) => (
            <button
              key={title}
              onClick={() => { setPrompt(`Help me with ${title.toLowerCase()}`); setChatOpen(true); }}
              className="glass group w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-left transition-all duration-300 hover:scale-[1.02] hover:border-violet-400/30 hover:shadow-[0_20px_50px_-15px_rgba(139,124,246,0.25)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300 transition-transform duration-300 group-hover:scale-110 group-hover:bg-violet-500/25">
                <Icon size={24} className="text-violet-200" />
              </div>
              <p className="mt-8 text-base font-medium text-white">{title}</p>
              <p className="mt-1 text-sm text-[#888]">{description}</p>
              <ArrowRight
                className="mt-5 text-[#555] transition group-hover:translate-x-1 group-hover:text-white"
                size={16}
              />
            </button>
          ))}
        </div>
      </section>

      <ModelsSection />
      <WorkspaceSection />
      <Compare onSuggestionClick={(title) => { setPrompt(title); setChatOpen(true); }} />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />

      <button
        onClick={() => setCommandOpen(true)}
        className="focus-ring fixed bottom-5 right-5 z-30 grid h-12 w-12 place-items-center rounded-full border border-[#444] bg-white text-black shadow-xl md:hidden"
        aria-label="Open command palette"
      >
        <Plus size={21} />
      </button>

      {previewOpen && <NetflixDemo onClose={() => setPreviewOpen(false)} />}

      {watchOpen && (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-black/80 px-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          aria-label="Vatsa product walkthrough"
        >
          <div className="animate-slide-up w-full max-w-3xl overflow-hidden rounded-3xl border border-[#3a3a3a] bg-[#0a0a0a]">
            <div className="flex justify-between p-4">
              <p className="text-sm font-medium text-white">Vatsa in 90 seconds</p>
              <button
                onClick={() => setWatchOpen(false)}
                className="focus-ring rounded-md p-1 text-[#aaa] hover:text-white"
                aria-label="Close walkthrough"
              >
                <X size={18} />
              </button>
            </div>
            <div className="surface-grid relative grid aspect-video place-items-center border-y border-[#222] bg-black">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,.13),transparent_40%)]" />
              <button
                onClick={() => setWatchOpen(false)}
                className="focus-ring magnetic relative grid h-16 w-16 place-items-center rounded-full bg-white text-black"
                aria-label="Play Vatsa walkthrough"
              >
                <Play className="ml-1" size={24} fill="currentColor" />
              </button>
              <p className="absolute bottom-6 text-xs text-[#aaa]">
                Prompt → route → artifact → deployment
              </p>
            </div>
            <div className="p-4 text-sm text-[#999]">
              A guided walkthrough of the Vatsa operating system. Your first workspace is ready in
              under a minute.
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-5 left-5 z-20 hidden rounded-xl border border-[#222] bg-black/75 px-3 py-2 text-[10px] text-[#777] backdrop-blur lg:flex">
        <CircleHelp className="mr-1.5" size={13} /> Press{" "}
        <span className="mx-1 rounded border border-[#333] px-1 text-[#aaa]">/</span> to focus Vatsa
      </div>

      <ChatWidget
        onSend={handleChatSend}
        initialMessages={chatMessages}
        isOpen={chatOpen}
        onToggle={() => setChatOpen(!chatOpen)}
      />

      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} initialMode={authMode} />}
    </>
  );
}