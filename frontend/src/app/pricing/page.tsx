"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Check, X, ChevronDown, Shield, Sparkles, Lock, Menu, Command, Star, Info } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { motion, useMotionValue, useSpring } from "framer-motion";
import {
  PLANS,
  PRICING_FAQS,
  TRUST_BADGES,
  FOOTER_LINKS,
  ANNUAL_BILLING_AVAILABLE,
  formatUsd,
  totalWithGst,
  type Plan,
  type BillingPeriod,
  type FaqEntry,
} from "@/lib/pricing/plans";

// ─── Background Component (unchanged) ──────────────────────────────
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0;
    const mouse = { x: -9999, y: -9999 };
    type P = { x: number; y: number; vx: number; vy: number; r: number; tw: number; vio: boolean };
    let parts: P[] = [];
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(80, Math.floor((w * h) / 17000));
      parts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.3 + 0.5,
        tw: Math.random() * Math.PI * 2,
        vio: Math.random() > 0.6,
      }));
    };
    const draw = () => {
      const t = performance.now() * 0.001;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < parts.length; i++) {
        const a = parts[i];
        for (let j = i + 1; j < parts.length; j++) {
          const b = parts[j];
          const dx = a.x - b.x;
          if (dx > 115 || dx < -115) continue;
          const dy = a.y - b.y;
          if (dy > 115 || dy < -115) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 < 13225) {
            const al = (1 - d2 / 13225) * 0.13;
            ctx.strokeStyle = `rgba(139,124,246,${al})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        const mdx = a.x - mouse.x;
        const mdy = a.y - mouse.y;
        const md2 = mdx * mdx + mdy * mdy;
        if (md2 < 30625) {
          const al = (1 - md2 / 30625) * 0.28;
          ctx.strokeStyle = `rgba(91,200,245,${al})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
      for (const p of parts) {
        const tw = 0.3 + 0.4 * Math.sin(t * 1.4 + p.tw);
        ctx.fillStyle = p.vio ? `rgba(167,139,250,${tw})` : `rgba(226,232,255,${tw * 0.85})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const step = () => {
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -12) p.x = w + 12;
        if (p.x > w + 12) p.x = -12;
        if (p.y < -12) p.y = h + 12;
        if (p.y > h + 12) p.y = -12;
      }
      draw();
      raf = requestAnimationFrame(step);
    };
    const onMove = (e: PointerEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    resize();
    if (reduced) draw();
    else raf = requestAnimationFrame(step);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);
  return <canvas ref={ref} className="fixed inset-0 z-[1]" aria-hidden="true" />;
}

function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,#0b0d1a_0%,#070812_42%,#05060a_100%)]" />
      <div className="absolute -left-[12%] -top-[18%] h-[60vmax] w-[60vmax] rounded-full opacity-45 blur-[130px]" style={{ background: "radial-gradient(circle, rgba(99,79,255,0.32), rgba(99,79,255,0.06) 55%, transparent 72%)", animation: "aurora-a 26s ease-in-out infinite" }} />
      <div className="absolute -right-[15%] top-[22%] h-[55vmax] w-[55vmax] rounded-full opacity-40 blur-[140px]" style={{ background: "radial-gradient(circle, rgba(42,168,224,0.26), rgba(42,168,224,0.05) 55%, transparent 72%)", animation: "aurora-b 32s ease-in-out infinite" }} />
      <div className="absolute bottom-[-22%] left-[18%] h-[52vmax] w-[52vmax] rounded-full opacity-35 blur-[150px]" style={{ background: "radial-gradient(circle, rgba(52,222,164,0.18), rgba(168,85,247,0.10) 55%, transparent 72%)", animation: "aurora-c 38s ease-in-out infinite" }} />
      <div className="absolute inset-0 opacity-[0.5]" style={{ backgroundImage: "linear-gradient(rgba(148,163,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,255,0.045) 1px, transparent 1px)", backgroundSize: "72px 72px", maskImage: "radial-gradient(ellipse 90% 62% at 50% 0%, #000 30%, transparent 78%)", WebkitMaskImage: "radial-gradient(ellipse 90% 62% at 50% 0%, #000 30%, transparent 78%)" }} />
      <Particles />
      <div className="absolute inset-0 z-[2] opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: NOISE }} />
    </div>
  );
}

// ─── Magnetic Component ──────────────────────────────────────────────
interface MagneticProps {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}

function Magnetic({ children, strength = 0.32, className = "" }: MagneticProps) {
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

// ─── Model Logos ──────────────────────────────────────────────────────
const modelLogos = [
  { name: "OpenAI", src: "/openai.png" },
  { name: "Claude", src: "/claude-color.png" },
  { name: "Gemini", src: "/gemini-color.png" },
  { name: "DeepSeek", src: "/deepseek-color.png" },
  { name: "Mistral", src: "/mistral-color.png" },
  { name: "Perplexity", src: "/perplexity-color.png" },
  { name: "Grok", src: "/grok.png" },
  { name: "Midjourney", src: "/midjourney.png" },
  { name: "Poe", src: "/poe-color.png" },
  { name: "Qwen", src: "/qwen-color.png" },
  { name: "Ollama", src: "/ollama.png" },
  { name: "Anthropic", src: "/anthropic.png" },
];

function ModelLogos() {
  return (
    <div className="scroll-reveal py-12">
      <h3 className="text-center text-sm font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-8">
        Powered by leading AI models
      </h3>
      <div className="flex flex-wrap items-center justify-center gap-8 gap-y-6 max-w-5xl mx-auto">
        {modelLogos.map((logo) => (
          <div key={logo.name} className="flex flex-col items-center gap-1">
            <div className="h-10 w-16 relative grayscale hover:grayscale-0 transition-all duration-300 opacity-70 hover:opacity-100">
              <Image
                src={logo.src}
                alt={logo.name}
                fill
                className="object-contain"
                sizes="64px"
              />
            </div>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
              {logo.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── VatsaMark (with logo.png) ──────────────────────────────────────
function VatsaMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="focus-ring inline-flex items-center gap-2 rounded-lg"
      aria-label="Vatsa AI home"
    >
      <div className="relative h-7 w-7">
        <Image
          src="/logo.png"
          alt="Vatsa AI"
          fill
          className="object-contain"
          sizes="28px"
        />
      </div>
      {!compact && (
        <span className="text-[17px] font-semibold tracking-[-.04em] text-gray-900 dark:text-white">
          vatsa<span className="text-gray-400 dark:text-gray-500">.ai</span>
        </span>
      )}
    </Link>
  );
}


const STYLES = `
          .scroll-reveal {
            opacity: 0;
            transform: translateY(32px);
            transition: opacity 0.7s ease, transform 0.7s ease;
          }
          .scroll-visible {
            opacity: 1;
            transform: translateY(0);
          }
          .gradient-text {
            background: linear-gradient(135deg, #2563eb, #7c3aed, #2563eb);
            background-size: 200% 200%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: shimmer 4s ease-in-out infinite alternate;
          }
          @keyframes shimmer {
            0% { background-position: 0% 50%; }
            100% { background-position: 100% 50%; }
          }
          .pricing-card {
            transition: all 0.3s ease;
          }
          .pricing-card:hover {
            transform: translateY(-6px);
            box-shadow: 0 20px 40px -12px rgba(0,0,0,0.25);
          }
          .dark .pricing-card:hover {
            box-shadow: 0 20px 40px -12px rgba(255,255,255,0.08);
          }
          .pricing-card-popular {
            border-color: #2563eb;
            box-shadow: 0 8px 30px -8px rgba(37,99,235,0.25);
          }
          .dark .pricing-card-popular {
            box-shadow: 0 8px 30px -8px rgba(37,99,235,0.15);
          }
          .badge-popular {
            background: #2563eb;
            color: #fff;
          }
          .btn-primary {
            background: #2563eb;
            color: #fff;
            transition: all 0.2s ease;
          }
          .btn-primary:hover {
            background: #1d4ed8;
          }
          .btn-outline {
            border: 1px solid #e5e7eb;
            color: #374151;
            transition: all 0.2s ease;
          }
          .btn-outline:hover {
            background: #f3f4f6;
            border-color: #d1d5db;
          }
          .dark .btn-outline {
            border-color: #374151;
            color: #d1d5db;
          }
          .dark .btn-outline:hover {
            background: #1f2937;
            border-color: #4b5563;
          }
          .btn-current {
            background: #10b981;
            color: #fff;
            cursor: default;
            opacity: 0.8;
          }
          .faq-item {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            overflow: hidden;
            transition: all 0.2s ease;
          }
          .dark .faq-item {
            border-color: #1f2937;
          }
          .faq-item:hover {
            border-color: #d1d5db;
          }
          .dark .faq-item:hover {
            border-color: #374151;
          }
          .faq-button {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem 1.25rem;
            text-align: left;
            font-weight: 500;
            background: transparent;
            border: none;
            cursor: pointer;
            color: inherit;
            transition: background 0.15s ease;
          }
          .faq-button:hover {
            background: rgba(0,0,0,0.02);
          }
          .dark .faq-button:hover {
            background: rgba(255,255,255,0.02);
          }
          .faq-answer {
            padding: 0 1.25rem 1.25rem 1.25rem;
            color: #6b7280;
            line-height: 1.7;
            font-size: 0.95rem;
          }
          .dark .faq-answer {
            color: #9ca3af;
          }
          .toggle-track {
            width: 44px;
            height: 24px;
            border-radius: 9999px;
            background: #d1d5db;
            position: relative;
            cursor: pointer;
            transition: background 0.25s ease;
            flex-shrink: 0;
          }
          .dark .toggle-track {
            background: #374151;
          }
          .toggle-track.active {
            background: #2563eb;
          }
          .toggle-thumb {
            position: absolute;
            top: 2px;
            left: 2px;
            width: 20px;
            height: 20px;
            border-radius: 9999px;
            background: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.15);
            transition: transform 0.25s ease;
          }
          .toggle-track.active .toggle-thumb {
            transform: translateX(20px);
          }
          .footer-link {
            color: #9ca3af;
            transition: color 0.15s ease;
            font-size: 0.8rem;
          }
          .footer-link:hover {
            color: #111827;
          }
          .dark .footer-link:hover {
            color: #f3f4f6;
          }
          @keyframes aurora-a {
            0% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(6%, -4%) scale(1.1); }
            100% { transform: translate(0, 0) scale(1); }
          }
          @keyframes aurora-b {
            0% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(-5%, 6%) scale(1.15); }
            100% { transform: translate(0, 0) scale(1); }
          }
          @keyframes aurora-c {
            0% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(8%, 3%) scale(1.05); }
            100% { transform: translate(0, 0) scale(1); }
          }
`;


// ─── FAQ accordion ──────────────────────────────────────────────────
function FaqAccordion({ items }: { items: FaqEntry[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-3xl divide-y divide-gray-200 dark:divide-gray-800 border-y border-gray-200 dark:border-gray-800">
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

// ─── Main Page ──────────────────────────────────────────────────────
export default function PricingPage() {
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const userTier = useAppStore((state) => state.userTier);

  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Scroll reveal
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

  /**
   * Free goes straight to sign-up. Paid plans need an account first, so an
   * anonymous visitor is sent to sign in with a redirect back to checkout
   * rather than being dropped on a page that would bounce them.
   */
  const handleCta = (plan: Plan) => {
    if (plan.id === "free") {
      router.push(isAuthenticated ? "/home" : "/signup?plan=free");
      return;
    }

    const checkout = `/checkout?plan=${plan.id}`;
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(checkout)}`);
      return;
    }
    router.push(checkout);
  };

  const ctaLabel = (plan: Plan) => {
    if (plan.id === "free") return isAuthenticated ? "Go to workspace" : plan.cta;
    if (userTier === plan.id) return "Current plan";
    return plan.cta;
  };

  return (
    <main className="relative min-h-screen bg-transparent text-gray-900 dark:text-gray-100">
      <Background />

      <div className="relative z-10">
        <style>{STYLES}</style>

        {/* ─── Navigation ─── */}
        <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/80">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
            <VatsaMark />

            <nav aria-label="Main" className="hidden items-center gap-6 text-sm text-gray-600 dark:text-gray-400 lg:flex">
              <Link href="/" className="transition-colors hover:text-gray-900 dark:hover:text-white">Home</Link>
              <Link href="/pricing" aria-current="page" className="text-gray-900 dark:text-white">Pricing</Link>
              <Link href="/home" className="transition-colors hover:text-gray-900 dark:hover:text-white">App</Link>
            </nav>

            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-500 sm:flex dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                <Command size={13} aria-hidden="true" /> K
              </span>

              {isAuthenticated ? (
                <>
                  <span className="hidden text-sm text-gray-600 sm:block dark:text-gray-300">
                    {user?.name || user?.full_name || user?.email}
                  </span>
                  <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] font-medium capitalize text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    {userTier}
                  </span>
                  <Link
                    href="/home"
                    className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                  >
                    Open app
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="hidden rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:text-gray-900 sm:block dark:text-gray-400 dark:hover:text-white"
                  >
                    Sign in
                  </Link>
                  <Magnetic strength={0.25}>
                    <Link
                      href="/signup"
                      className="inline-block rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                    >
                      Start building
                    </Link>
                  </Magnetic>
                </>
              )}

              <button
                type="button"
                onClick={() => setMobileNavOpen((v) => !v)}
                aria-expanded={mobileNavOpen}
                aria-controls="mobile-nav"
                aria-label="Toggle navigation"
                className="rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:border-gray-300 lg:hidden dark:border-gray-800 dark:text-gray-400"
              >
                <Menu size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          {mobileNavOpen && (
            <nav
              id="mobile-nav"
              aria-label="Mobile"
              className="border-t border-gray-200 px-5 py-3 lg:hidden dark:border-gray-800"
            >
              <div className="flex flex-col gap-3 text-sm">
                <Link href="/" onClick={() => setMobileNavOpen(false)}>Home</Link>
                <Link href="/pricing" onClick={() => setMobileNavOpen(false)}>Pricing</Link>
                <Link href="/home" onClick={() => setMobileNavOpen(false)}>App</Link>
                {!isAuthenticated && <Link href="/login" onClick={() => setMobileNavOpen(false)}>Sign in</Link>}
              </div>
            </nav>
          )}
        </header>

        {/* ─── Breadcrumb ─── */}
        <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-5 pt-6 lg:px-8">
          <ol className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            <li><Link href="/" className="hover:underline">Home</Link></li>
            <li aria-hidden="true" className="mx-2">/</li>
            <li aria-current="page" className="font-medium text-gray-700 dark:text-gray-300">Pricing</li>
          </ol>
        </nav>

        {/* ─── Hero ─── */}
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

        {/* ─── Billing toggle ─── */}
        <section className="mx-auto max-w-7xl px-5 pb-8 lg:px-8">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center gap-3" role="group" aria-label="Billing period">
              <span
                className={cn(
                  "text-sm font-medium",
                  billing === "monthly" ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-600"
                )}
              >
                Monthly
              </span>

              <button
                type="button"
                role="switch"
                aria-checked={billing === "annual"}
                aria-label="Bill annually"
                disabled={!ANNUAL_BILLING_AVAILABLE}
                title={ANNUAL_BILLING_AVAILABLE ? undefined : "Annual billing is not available yet"}
                onClick={() =>
                  ANNUAL_BILLING_AVAILABLE && setBilling(billing === "monthly" ? "annual" : "monthly")
                }
                className={cn(
                  "relative h-6 w-11 rounded-full border transition-colors",
                  billing === "annual" ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700",
                  ANNUAL_BILLING_AVAILABLE
                    ? "cursor-pointer border-transparent"
                    : "cursor-not-allowed border-dashed border-gray-400 opacity-50 dark:border-gray-600"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                    billing === "annual" ? "translate-x-[22px]" : "translate-x-0.5"
                  )}
                />
              </button>

              <span
                className={cn(
                  "text-sm font-medium",
                  billing === "annual" ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-600"
                )}
              >
                Annual
              </span>
            </div>

            {!ANNUAL_BILLING_AVAILABLE && (
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Annual billing is coming soon — monthly pricing is shown below.
              </p>
            )}
          </div>
        </section>

        {/* ─── Plans ─── */}
        <section aria-label="Plans" className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrent = isAuthenticated && userTier === plan.id;
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "pricing-card relative flex flex-col rounded-2xl border bg-white p-6 dark:bg-gray-950",
                    plan.popular
                      ? "pricing-card-popular border-blue-600"
                      : "border-gray-200 dark:border-gray-800"
                  )}
                >
                  {plan.popular && (
                    <span className="badge-popular absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold">
                      Most Popular
                    </span>
                  )}

                  <div className="mb-5">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold">{plan.name}</h2>
                      {plan.popular && <Star className="h-4 w-4 fill-blue-500 text-blue-500" aria-hidden="true" />}
                    </div>

                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-4xl font-bold">{formatUsd(plan.price)}</span>
                      <span className="text-gray-500 dark:text-gray-400">/month</span>
                    </div>

                    {plan.gstNote && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Info className="h-3 w-3" aria-hidden="true" />
                        {plan.gstNote}
                        <span className="sr-only">
                          . Total {formatUsd(totalWithGst(plan.price))} per month including GST.
                        </span>
                      </p>
                    )}

                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{plan.description}</p>
                  </div>

                  <ul className="mb-6 flex-1 space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" aria-hidden="true" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                    {plan.disabledFeatures.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
                        <span className="text-sm text-gray-400 line-through dark:text-gray-500">
                          {feature}
                          <span className="sr-only"> (not included)</span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto">
                    <Magnetic strength={0.2}>
                      <button
                        type="button"
                        onClick={() => handleCta(plan)}
                        disabled={isCurrent}
                        aria-label={`${ctaLabel(plan)} — ${plan.name} plan`}
                        className={cn(
                          "w-full rounded-xl px-4 py-2.5 text-center text-sm font-medium transition-all",
                          plan.popular ? "btn-primary" : "btn-outline",
                          isCurrent && "cursor-not-allowed opacity-60"
                        )}
                      >
                        {ctaLabel(plan)}
                      </button>
                    </Magnetic>

                    {plan.note && (
                      <p className="mt-3 flex items-center justify-center gap-1 text-center text-xs text-gray-400 dark:text-gray-500">
                        <Lock className="h-3 w-3" aria-hidden="true" />
                        {plan.note}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <ModelLogos />

        {/* ─── FAQ ─── */}
        <section className="scroll-reveal mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <h2 className="mb-10 text-center text-3xl font-bold">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
          <FaqAccordion items={PRICING_FAQS} />
        </section>

        {/* ─── Trust badges ─── */}
        <section className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-gray-500 dark:text-gray-400">
            {TRUST_BADGES.map((badge) => (
              <li key={badge} className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" aria-hidden="true" />
                <span className="text-sm">{badge}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── Footer ─── */}
        <footer className="border-t border-gray-200 py-10 dark:border-gray-800">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <VatsaMark compact />
              <p className="text-xs text-gray-400 dark:text-gray-500">
                © 2026 Vatsa AI. Intelligence, orchestrated.
              </p>
              <nav aria-label="Footer" className="flex flex-wrap gap-4">
                {FOOTER_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} className="footer-link">
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
