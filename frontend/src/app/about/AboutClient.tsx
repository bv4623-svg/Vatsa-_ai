"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Sparkles, Shield, Zap, Globe, Lock, ChevronRight, Mail } from "lucide-react";
import { LegalPageLayout } from "@/components/layout/LegalPageLayout";
import { BUSINESS } from "@/config/business";
import { BusinessInfo } from "@/components/business/BusinessInfo";

// ─── Background ──────────────────────────────────────────────────────
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

// ─── Main Client Component ──────────────────────────────────────
export default function AboutClient() {
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

        <LegalPageLayout>
        {/* ─── Breadcrumb ─── */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <Link href="/" className="hover:underline">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700 dark:text-gray-300 font-medium">About</span>
        </div>

        {/* ─── Hero ─── */}
        <div className="pt-8 pb-6 scroll-reveal">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 text-xs font-medium mb-4 backdrop-blur-sm">
              <Sparkles className="w-4 h-4" />
              Our story
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">
              About <span className="gradient-text">Vatsa AI</span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mt-4 max-w-2xl mx-auto">
              Building the most accessible and intelligent AI assistant platform.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-3 border-b border-gray-200 dark:border-gray-800 pb-4">
              <span className="font-semibold text-gray-600 dark:text-gray-300">Last Updated:</span> September 25, 2026
            </p>
          </div>
        </div>

        {/* ─── Content ─── */}
        <div className="pb-12">
          <div className="glass-card rounded-2xl p-8 md:p-12 scroll-reveal">
            <div className="prose prose-lg dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
              <p className="text-xl font-light">
                Based in <strong className="text-gray-900 dark:text-white">{BUSINESS.locality}</strong>, Vatsa AI is on a mission to build the most accessible and intelligent AI assistant platform.
              </p>

              <h2 className="text-2xl font-bold mt-8 flex items-center gap-2 text-gray-900 dark:text-white">
                <Zap className="w-6 h-6 text-blue-400" />
                Our Mission
              </h2>
              <p>
                To democratize artificial intelligence by providing powerful, affordable, and easy-to-use AI tools for businesses, developers, and individuals across the globe.
              </p>

              <h2 className="text-2xl font-bold mt-8 flex items-center gap-2 text-gray-900 dark:text-white">
                <Globe className="w-6 h-6 text-blue-400" />
                Our Vision
              </h2>
              <p>
                To become the backbone of AI-driven workflows, enabling human potential through seamless human-AI collaboration.
              </p>

              <h2 className="text-2xl font-bold mt-8 flex items-center gap-2 text-gray-900 dark:text-white">
                <Shield className="w-6 h-6 text-blue-400" />
                Security & Privacy
              </h2>
              <p>
                We take data protection seriously. All interactions are encrypted, and we never use your data to train public models without explicit consent.
              </p>

              <h2 className="text-2xl font-bold mt-8 flex items-center gap-2 text-gray-900 dark:text-white">
                <ChevronRight className="w-6 h-6 text-blue-400" />
                Future Roadmap
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Q4 2026:</strong> Launch of Vatsa AI Custom Models (Enterprise fine-tuning).</li>
                <li><strong>Q1 2027:</strong> Multimodal capabilities (Image + Text).</li>
                <li><strong>Q3 2027:</strong> On-premise deployments for government and defense sectors.</li>
              </ul>

              <h2 className="text-2xl font-bold mt-8 flex items-center gap-2 text-gray-900 dark:text-white">
                <Mail className="w-6 h-6 text-blue-400" />
                Business Information
              </h2>
              <BusinessInfo className="not-prose mt-4" />
            </div>
          </div>

          {/* ─── Trust badge extra ─── */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 scroll-reveal">
            <div className="glass-card rounded-xl p-6 text-center">
              <Lock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <h4 className="font-semibold text-gray-900 dark:text-white">End-to-End Encryption</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Your data stays private</p>
            </div>
            <div className="glass-card rounded-xl p-6 text-center">
              <Shield className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <h4 className="font-semibold text-gray-900 dark:text-white">GDPR Compliant</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Global privacy standards</p>
            </div>
            <div className="glass-card rounded-xl p-6 text-center">
              <Zap className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <h4 className="font-semibold text-gray-900 dark:text-white">99.9% Uptime</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Reliable AI infrastructure</p>
            </div>
          </div>
        </div>
        </LegalPageLayout>
      </div>
    </main>
  );
}