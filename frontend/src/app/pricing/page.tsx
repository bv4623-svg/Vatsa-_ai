"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Check, X, ChevronDown, ChevronUp, Shield, Sparkles, Lock, Mail, Menu, Command, Star, Info } from "lucide-react";
import { useAppStore, PRICING_PLANS } from "@/stores/app-store";
import { motion, useMotionValue, useSpring } from "framer-motion";

// ─── Global Razorpay Declaration ─────────────────────────────
declare global {
  interface Window {
    Razorpay: any;
  }
}

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

// ─── FAQ ──────────────────────────────────────────────────────────────
type FAQItem = {
  question: string;
  answer: string;
};

const faqs: FAQItem[] = [
  {
    question: "What happens after the free trial?",
    answer: "Your Free plan continues with 10 messages per day. No charges unless you upgrade to Pro. Your data and conversations are preserved.",
  },
  {
    question: "Can I switch plans anytime?",
    answer: "Yes! You can upgrade or downgrade anytime. When upgrading, you get immediate access to Pro features. When downgrading, changes take effect at the end of your billing period.",
  },
  {
    question: "Do you offer refunds?",
    answer: "We offer a 14-day money-back guarantee on Pro plans. If you're not satisfied, contact support within 14 days for a full refund.",
  },
  {
    question: "What's included in Deep Research?",
    answer: "Deep Research uses multi-step orchestration to search, scrape, analyze, and synthesize information from multiple sources. It creates a research plan, executes it step by step, and delivers a comprehensive, cited answer.",
  },
  {
    question: "How does smart routing work?",
    answer: "Vatsa AI analyzes your query complexity and automatically routes it to the best AI model. Simple questions go to fast models, complex reasoning to advanced models. You always see which model was used and why.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes. Enterprise-grade encryption at rest and in transit. We don't train on your data. Enterprise customers can opt for on-premise deployment with full data sovereignty.",
  },
];

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

// ─── Main Page ──────────────────────────────────────────────────────
export default function PricingPage() {
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const userTier = useAppStore((state) => state.userTier);
  const addToast = useAppStore((state) => state.addToast);
  const setUserTier = useAppStore((state) => state.setUserTier);

  const [isAnnual, setIsAnnual] = useState(false);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // ─── Custom plans with feature objects ──────────────────────
  const plans = [
    {
      id: "free",
      name: "Free",
      price: 0,
      description: "Basic access to get started",
      features: [
        { label: "100 AI credits / month", included: true },
        { label: "All core workspaces", included: true },
        { label: "Community templates", included: true },
        { label: "Basic AI models (GPT-3.5, Claude Instant)", included: true },
        { label: "2 GB storage", included: true },
        { label: "Community support", included: true },
        { label: "Limited chat history (30 days)", included: true },
        { label: "Standard response speed", included: true },
        { label: "Single device session", included: true },
        { label: "Code execution", included: false },
        { label: "Custom models", included: false },
        { label: "Team collaboration", included: false },
      ],
      popular: false,
    },
    {
      id: "pro",
      name: "Pro",
      price: 24,
      description: "Unleash the full power of AI",
      features: [
        { label: "Unlimited AI credits", included: true },
        { label: "Premium model routing (Claude Opus 5, GPT-5.6, Gemini 3.6)", included: true },
        { label: "Artifacts & project memory", included: true },
        { label: "Priority support", included: true },
        { label: "Code execution (Python, JS, SQL, etc.)", included: true },
        { label: "Advanced analytics & insights", included: true },
        { label: "Unlimited chat history", included: true },
        { label: "Faster response times", included: true },
        { label: "Multi-device sync", included: true },
        { label: "Custom prompt templates", included: true },
        { label: "Collaborative workspaces (coming soon)", included: true },
        { label: "API access (beta)", included: true },
      ],
      popular: true,
    },
    {
      id: "business",
      name: "Business",
      price: 99,
      description: "Enterprise-grade AI for teams",
      features: [
        { label: "Everything in Pro", included: true },
        { label: "Unlimited smart routing", included: true },
        { label: "Shared workspaces", included: true },
        { label: "Priority support & SSO", included: true },
        { label: "Custom model fine-tuning", included: true },
        { label: "Team analytics dashboard", included: true },
        { label: "Advanced security (GDPR, SOC2)", included: true },
        { label: "Dedicated account manager", included: true },
        { label: "On-premise deployment (optional)", included: true },
        { label: "Custom SLAs", included: true },
        { label: "Bulk user management", included: true },
        { label: "Data export & backup", included: true },
      ],
      popular: false,
    },
  ];

  // ─── GST Helper ──────────────────────────────────────────────
  const GST_RATE = 0.18;

  const getBasePrice = (plan: any) => {
    if (plan.id === "free") return 0;
    return isAnnual ? plan.price * 10 : plan.price;
  };

  const getTotalWithGST = (plan: any) => {
    const base = getBasePrice(plan);
    return base * (1 + GST_RATE);
  };

  const getGSTAmount = (plan: any) => {
    const base = getBasePrice(plan);
    return base * GST_RATE;
  };

  // ─── Price display helpers ──────────────────────────────────
  const getPriceLabel = (plan: any) => {
    if (plan.id === "free") return "/month";
    return isAnnual ? "/year" : "/month";
  };

  const getAnnualSavings = (plan: any) => {
    if (plan.id === "pro" || plan.id === "business") {
      const monthly = plan.price;
      const annual = plan.price * 10;
      const saving = monthly * 12 - annual;
      return `Save $${saving}/year`;
    }
    return null;
  };

  const getMonthlyEquivalent = (plan: any) => {
    if ((plan.id === "pro" || plan.id === "business") && isAnnual) {
      const annualPrice = plan.price * 10;
      return `$${Math.round(annualPrice / 12)}/mo`;
    }
    return null;
  };

  // ─── RAZORPAY INTEGRATION (unchanged) ──────────────────────
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleRazorpayPayment = async (planId: string, amount: number) => {
    // 🔥 TEST: Hardcode ₹24 (2400 paise) for testing
    const amountInPaise = Math.round(amount * 100);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        addToast({ message: "Razorpay SDK load nahi ho paaya. Internet check karo.", type: "error" });
        return;
      }

      // 1. Create order from backend
      const response = await fetch("http://localhost:8000/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: "INR",
          receipt: `receipt_${planId}`
        })
      });
      const orderData = await response.json();

      // 2. Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Vatsa AI",
        description: `${planId} Plan - ${isAnnual ? "Annual" : "Monthly"} Billing`,
        order_id: orderData.order_id,
        prefill: {
          name: user?.name || "Customer",
          email: user?.email || "customer@example.com",
          contact: "9999999999"
        },
        theme: { color: "#2563eb" },
        handler: async (response: any) => {
          // 3. Verify payment
          try {
            const verifyRes = await fetch("http://localhost:8000/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: orderData.order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            const result = await verifyRes.json();
            if (result.status === "success") {
              setUserTier("premium");
              addToast({ message: "🎉 Payment successful! Welcome to Pro.", type: "success" });
              router.push("/home");
            } else {
              addToast({ message: "Payment verification failed. Please contact support.", type: "error" });
            }
          } catch (error) {
            console.error(error);
            addToast({ message: "Verification error. Please contact support.", type: "error" });
          }
        }
      };
      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error(error);
      addToast({ message: "Payment initiation failed. Please try again.", type: "error" });
    }
  };

  // ─── handleSubscribe (updated to show GST total) ───────────
  const handleSubscribe = async (planId: string) => {
    if (planId === "free") {
      router.push("/home");
      return;
    }

    if (!isAuthenticated) {
      addToast({ message: "Please sign in first to subscribe.", type: "error" });
      router.push("/auth/login");
      return;
    }

    setIsSubscribing(true);
    try {
      const plan = plans.find(p => p.id === planId);
      if (!plan) throw new Error("Plan not found");

      // Show total with GST in toast (final price at checkout)
      const base = getBasePrice(plan);
      const gst = getGSTAmount(plan);
      const total = getTotalWithGST(plan);
      addToast({
        message: `💳 Total: $${total.toFixed(2)} (Base $${base.toFixed(2)} + 18% GST $${gst.toFixed(2)})`,
        type: "info"
      });

      // Call Razorpay with the amount (in paise) – for now hardcoded ₹24
      // In production, pass total*100 (paise) to handleRazorpayPayment
      await handleRazorpayPayment(planId, total);
    } catch (error) {
      console.error(error);
      addToast({ message: "Something went wrong. Please try again.", type: "error" });
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleEnterpriseContact = () => {
    const email = "enterprise@vatsa.ai";
    const subject = "Enterprise Plan Inquiry";
    const body = "Hi Vatsa AI Team,%0D%0A%0D%0AI'm interested in the Enterprise plan. Please contact me with more details.%0D%0A%0D%0AThank you!";
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    addToast({ message: "📧 Opening your email client to contact enterprise sales.", type: "info" });
  };

  // ─── Scroll animations ──────────────────────────────────────
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

  return (
    <main className="relative min-h-screen bg-transparent text-gray-900 dark:text-gray-100">
      <Background />

      <div className="relative z-10">
        <style>{`
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
        `}</style>

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
              {isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{user?.name}</span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium border",
                      userTier === "premium"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                    )}
                  >
                    {userTier === "premium" ? "✨ Pro" : "Free"}
                  </span>
                </div>
              ) : (
                <Link href="/auth/login" className="focus-ring hidden rounded-lg px-3 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white sm:block transition-colors">
                  Sign in
                </Link>
              )}
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
            <span className="text-gray-700 dark:text-gray-300 font-medium">Pricing</span>
          </div>
        </div>

        {/* ─── Hero ─── */}
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-8 pb-6 scroll-reveal">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 text-xs font-medium mb-4 backdrop-blur-sm">
              <Sparkles className="w-4 h-4" />
              Simple, transparent pricing
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">
              Choose the plan that fits <span className="gradient-text">you</span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mt-4 max-w-2xl mx-auto">
              Start free, upgrade anytime. No credit card required.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-3 border-b border-gray-200 dark:border-gray-800 pb-4">
              <span className="font-semibold text-gray-600 dark:text-gray-300">Last Updated:</span> August 3, 2026
            </p>
          </div>
        </div>

        {/* ─── Billing toggle ─── */}
        <div className="flex items-center justify-center gap-3 pb-8 scroll-reveal">
          <span className={cn("text-sm font-medium", !isAnnual ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-600")}>
            Monthly
          </span>
          <div className={cn("toggle-track", isAnnual && "active")} onClick={() => setIsAnnual(!isAnnual)} role="button" tabIndex={0} aria-label="Toggle billing period">
            <div className="toggle-thumb" />
          </div>
          <span className={cn("text-sm font-medium", isAnnual ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-600")}>
            Annual
          </span>
          {isAnnual && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800">
              Save 16%
            </span>
          )}
        </div>

        {/* ─── Pricing Cards ─── */}
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan) => {
              const isFree = plan.id === "free";
              const isPro = plan.id === "pro";
              const isBusiness = plan.id === "business";
              const isPopular = plan.popular;
              const base = getBasePrice(plan);
              const total = getTotalWithGST(plan);
              const gst = getGSTAmount(plan);

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "pricing-card relative rounded-2xl border p-8 flex flex-col scroll-reveal bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm",
                    isPopular
                      ? "border-blue-500 dark:border-blue-400 pricing-card-popular"
                      : "border-gray-200 dark:border-gray-800"
                  )}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full badge-popular text-xs font-medium">
                      Most Popular
                    </div>
                  )}

                  <div className="flex-1">
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                      {plan.name}
                      {isPopular && <Star className="w-4 h-4 fill-blue-500 text-blue-500" />}
                    </h2>
                    <div className="mt-4">
                      {!isFree ? (
                        <>
                          <div className="flex items-baseline gap-1">
                            <span className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                              ${base.toFixed(2)}
                            </span>
                            <span className="ml-1 text-gray-500 dark:text-gray-400 text-sm">
                              {getPriceLabel(plan)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-xs text-gray-400 dark:text-gray-500">
                            <Info className="w-3.5 h-3.5" />
                            <span>+ 18% GST</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                            $0
                          </span>
                          <span className="ml-1 text-gray-500 dark:text-gray-400 text-sm">/month</span>
                        </div>
                      )}
                    </div>

                    {(isPro || isBusiness) && isAnnual && getMonthlyEquivalent(plan) && (
                      <span className="text-sm text-gray-500 dark:text-gray-400 block mt-1">
                        ({getMonthlyEquivalent(plan)})
                      </span>
                    )}
                    {(isPro || isBusiness) && getAnnualSavings(plan) && isAnnual && (
                      <span className="inline-block mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        {getAnnualSavings(plan)}
                      </span>
                    )}
                    <p className="mt-4 text-gray-600 dark:text-gray-400">
                      {plan.description}
                    </p>

                    <ul className="mt-6 space-y-3">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          {feature.included ? (
                            <Check className="w-5 h-5 text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" />
                          ) : (
                            <X className="w-5 h-5 text-red-400 dark:text-red-500 mt-0.5 shrink-0" />
                          )}
                          <span
                            className={cn(
                              "text-sm",
                              feature.included
                                ? "text-gray-700 dark:text-gray-300"
                                : "text-gray-400 dark:text-gray-500 line-through"
                            )}
                          >
                            {feature.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8">
                    <Magnetic strength={0.2}>
                      <button
                        onClick={() => {
                          if (isFree) {
                            router.push("/home");
                          } else {
                            handleSubscribe(plan.id);
                          }
                        }}
                        disabled={isSubscribing && !isFree}
                        className={cn(
                          "w-full py-2.5 px-4 rounded-xl text-center font-medium transition-all text-sm",
                          isPopular ? "btn-primary" : "btn-outline",
                          isSubscribing && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {isFree ? "Free" : isSubscribing ? "Processing..." : "Get Started"}
                      </button>
                    </Magnetic>
                    {!isFree && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-3">
                        Secure payment via Razorpay
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Model Logos ─── */}
        <ModelLogos />

        {/* ─── FAQ ─── */}
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pb-20">
          <div className="max-w-3xl mx-auto scroll-reveal">
            <h2 className="text-2xl font-bold text-center mb-8 text-gray-900 dark:text-white">
              Frequently Asked <span className="gradient-text">Questions</span>
            </h2>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div key={i} className="faq-item bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                  <button
                    onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                    className="faq-button"
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {faq.question}
                    </span>
                    {openFAQ === i ? (
                      <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                    )}
                  </button>
                  {openFAQ === i && (
                    <div className="faq-answer">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Trust Badges ─── */}
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pb-16 scroll-reveal">
          <div className="flex flex-wrap items-center justify-center gap-6 text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span className="text-sm">Enterprise Security</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm">99.9% Uptime</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              <span className="text-sm">GDPR Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              <span className="text-sm">24/7 Support</span>
            </div>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <footer className="border-t border-gray-200 dark:border-gray-800 py-6 bg-white/60 dark:bg-gray-950/60 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-5 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <VatsaMark compact />
              <p className="text-xs text-gray-400 dark:text-gray-500">
                © 2026 Vatsa AI. Intelligence, orchestrated.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/about" className="footer-link">About</Link>
                <Link href="/contact" className="footer-link">Contact</Link>
                <Link href="/disclaimer" className="footer-link">Disclaimer</Link>
                <Link href="/refund" className="footer-link">Refund Policy</Link>
                <Link href="/return" className="footer-link">Return Policy</Link>
                <Link href="/security" className="footer-link">Security</Link>
                <Link href="/payment" className="footer-link">Payments</Link>
                <Link href="/privacy" className="footer-link">Privacy</Link>
                <Link href="/terms" className="footer-link">Terms</Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}