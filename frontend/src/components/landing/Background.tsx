import { useEffect, useRef } from "react";

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
    let w = 0;
    let h = 0;
    let raf = 0;
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

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    resize();
    if (reduced) {
      draw();
    } else {
      raf = requestAnimationFrame(step);
    }
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

export default function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* base graphite gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,#0b0d1a_0%,#070812_42%,#05060a_100%)]" />

      {/* aurora blobs */}
      <div
        className="absolute -left-[12%] -top-[18%] h-[60vmax] w-[60vmax] rounded-full opacity-45 blur-[130px]"
        style={{
          background: "radial-gradient(circle, rgba(99,79,255,0.32), rgba(99,79,255,0.06) 55%, transparent 72%)",
          animation: "aurora-a 26s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -right-[15%] top-[22%] h-[55vmax] w-[55vmax] rounded-full opacity-40 blur-[140px]"
        style={{
          background: "radial-gradient(circle, rgba(42,168,224,0.26), rgba(42,168,224,0.05) 55%, transparent 72%)",
          animation: "aurora-b 32s ease-in-out infinite",
        }}
      />
      <div
        className="absolute bottom-[-22%] left-[18%] h-[52vmax] w-[52vmax] rounded-full opacity-35 blur-[150px]"
        style={{
          background: "radial-gradient(circle, rgba(52,222,164,0.18), rgba(168,85,247,0.10) 55%, transparent 72%)",
          animation: "aurora-c 38s ease-in-out infinite",
        }}
      />

      {/* faint grid */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,255,0.045) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse 90% 62% at 50% 0%, #000 30%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 62% at 50% 0%, #000 30%, transparent 78%)",
        }}
      />

      <Particles />

      {/* film grain */}
      <div className="absolute inset-0 z-[2] opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: NOISE }} />
    </div>
  );
}