/** Pure-CSS animated "AI core" visual for the login split-screen -- no
 * external 3D library, no image/video asset. A radial-gradient sphere with
 * two rotating conic rings and a handful of floating particles, all done
 * with CSS animations declared in the scoped <style> tag below (keyframes
 * need unique names since this can render alongside other pages that also
 * define animations). */
export function AIOrb() {
  return (
    <div className="relative flex h-64 w-64 items-center justify-center lg:h-80 lg:w-80" aria-hidden="true">
      <style>{`
        @keyframes vatsa-orb-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes vatsa-orb-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes vatsa-orb-spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes vatsa-orb-float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.2; }
          50% { transform: translateY(-14px) translateX(6px); opacity: 0.8; }
        }
        @media (prefers-reduced-motion: reduce) {
          .vatsa-orb-core, .vatsa-orb-ring, .vatsa-orb-particle {
            animation: none !important;
          }
        }
      `}</style>

      {/* Rotating rings */}
      <div
        className="vatsa-orb-ring absolute inset-0 rounded-full border border-indigo-400/20"
        style={{ animation: "vatsa-orb-spin 22s linear infinite" }}
      />
      <div
        className="vatsa-orb-ring absolute inset-6 rounded-full border border-violet-400/20 border-dashed"
        style={{ animation: "vatsa-orb-spin-reverse 30s linear infinite" }}
      />

      {/* Floating particles */}
      {[
        { top: "10%", left: "18%", delay: "0s", size: 3 },
        { top: "70%", left: "12%", delay: "1.2s", size: 2 },
        { top: "20%", left: "85%", delay: "0.6s", size: 2 },
        { top: "80%", left: "78%", delay: "2s", size: 3 },
        { top: "45%", left: "5%", delay: "1.6s", size: 2 },
      ].map((p, i) => (
        <span
          key={i}
          className="vatsa-orb-particle absolute rounded-full bg-indigo-300/70"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            animation: `vatsa-orb-float ${8 + i}s ease-in-out ${p.delay} infinite`,
          }}
        />
      ))}

      {/* The core sphere */}
      <div
        className="vatsa-orb-core relative h-32 w-32 rounded-full lg:h-40 lg:w-40"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, rgba(165,145,255,0.95), rgba(99,102,241,0.85) 40%, rgba(30,20,70,0.9) 75%)",
          boxShadow: "0 0 60px 10px rgba(99,102,241,0.35), 0 0 120px 30px rgba(139,92,246,0.15)",
          animation: "vatsa-orb-pulse 4s ease-in-out infinite",
        }}
      />
    </div>
  );
}
