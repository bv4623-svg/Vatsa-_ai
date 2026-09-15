"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { Menu, Command, Sparkles, Mail, MapPin, Clock } from "lucide-react";

// ─── Background Component ──────────────────────────────────────────────
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
    let w = 0,
      h = 0,
      raf = 0;
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

// ─── VatsaMark ──────────────────────────────────────────────────────
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

// ─── Main Contact Page ──────────────────────────────────────────────
export default function ContactPage() {
  const router = useRouter();

  // Scroll reveal
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate submission
    alert("Thank you! We'll get back to you shortly.");
  };

  return (
    <main className="relative min-h-screen bg-transparent text-gray-900 dark:text-gray-100">
      <Background />

      <div className="relative z-10">
        {/* Embedded styles */}
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
          .glass-card {
            background: rgba(255,255,255,0.06);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.08);
          }
          .dark .glass-card {
            background: rgba(255,255,255,0.04);
            border-color: rgba(255,255,255,0.06);
          }
          .input-dark {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.08);
            color: #fff;
          }
          .input-dark:focus {
            border-color: #2563eb;
            outline: none;
            box-shadow: 0 0 0 3px rgba(37,99,235,0.2);
          }
          .input-dark::placeholder {
            color: rgba(255,255,255,0.3);
          }
          .btn-primary {
            background: #2563eb;
            color: #fff;
            transition: all 0.2s ease;
          }
          .btn-primary:hover {
            background: #1d4ed8;
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
              <Link href="/auth/login" className="focus-ring hidden rounded-lg px-3 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white sm:block transition-colors">
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
            <span className="text-gray-700 dark:text-gray-300 font-medium">Contact</span>
          </div>
        </div>

        {/* ─── Hero ─── */}
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-8 pb-6 scroll-reveal">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 text-xs font-medium mb-4 backdrop-blur-sm">
              <Sparkles className="w-4 h-4" />
              We're here to help
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">
              Let's <span className="gradient-text">Talk</span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mt-4 max-w-2xl mx-auto">
              Have questions about our AI models, enterprise solutions, or need support?
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-3 border-b border-gray-200 dark:border-gray-800 pb-4">
              <span className="font-semibold text-gray-600 dark:text-gray-300">Last Updated:</span> August 2, 2026
            </p>
          </div>
        </div>

        {/* ─── Contact Form + Info ─── */}
        <div className="max-w-7xl mx-auto px-5 lg:px-8 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Form */}
            <div className="glass-card rounded-2xl p-8 scroll-reveal">
              <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">Send us a message</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    className="w-full px-4 py-3 rounded-lg input-dark focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    className="w-full px-4 py-3 rounded-lg input-dark focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="john@example.com"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="model-interest" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">I'm interested in</label>
                  <select
                    id="model-interest"
                    className="w-full px-4 py-3 rounded-lg input-dark focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option>General AI Assistant</option>
                    <option>Large Language Models (Enterprise)</option>
                    <option>Custom Fine-Tuning</option>
                    <option>API Integration</option>
                    <option>Billing / Payment Support</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Message</label>
                  <textarea
                    id="message"
                    rows={5}
                    className="w-full px-4 py-3 rounded-lg input-dark focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="Tell us about your large-scale AI needs..."
                    required
                  />
                </div>
                <Magnetic strength={0.2}>
                  <button
                    type="submit"
                    className="w-full btn-primary font-semibold py-3 px-6 rounded-lg transition"
                  >
                    Send Message
                  </button>
                </Magnetic>
              </form>
            </div>

            {/* Info */}
            <div className="space-y-6 scroll-reveal">
              <div className="glass-card rounded-2xl p-8">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                  <MapPin className="w-5 h-5 text-blue-400" />
                  Location
                </h3>
                <p className="text-gray-600 dark:text-gray-400">Purnea, Bihar, India</p>
                <p className="text-gray-600 dark:text-gray-400">Asia/Kolkata (IST)</p>
                <hr className="my-4 border-gray-200 dark:border-gray-700" />
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                  <Mail className="w-5 h-5 text-blue-400" />
                  Email Us
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  <strong>Support:</strong>{" "}
                  <a href="mailto:support@vatsaai.com" className="text-blue-500 hover:underline">support@vatsaai.com</a>
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  <strong>Business / Enterprise:</strong>{" "}
                  <a href="mailto:contact@vatsaai.com" className="text-blue-500 hover:underline">contact@vatsaai.com</a>
                </p>
                <hr className="my-4 border-gray-200 dark:border-gray-700" />
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                  <Clock className="w-5 h-5 text-blue-400" />
                  Business Hours
                </h3>
                <p className="text-gray-600 dark:text-gray-400">Monday - Friday</p>
                <p className="text-gray-600 dark:text-gray-400">10:00 AM – 6:00 PM IST</p>
              </div>

              <div className="bg-blue-50/80 dark:bg-blue-950/30 backdrop-blur-sm p-6 rounded-2xl border border-blue-200 dark:border-blue-900">
                <h4 className="font-bold text-lg text-blue-800 dark:text-blue-300">🚀 Enterprise & Large Models</h4>
                <p className="text-blue-700 dark:text-blue-400 mt-2">
                  Need custom AI models trained on your data? We offer dedicated infrastructure for large-scale AI deployments.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Model Logos ─── */}
        <ModelLogos />

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
                <Link href="/pricing" className="footer-link">Pricing</Link>
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