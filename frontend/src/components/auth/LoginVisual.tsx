"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

/** The login page's left-panel visual: a looping muted background video with
 * overlaid brand copy. The parent hides this whole panel below lg with CSS
 * (see app/login/page.tsx), but display:none alone doesn't stop a browser
 * from still fetching a preload="metadata" video -- so the <video> tag
 * itself is only mounted once a lg-or-wider viewport is confirmed, meaning
 * mobile never issues a single byte of network request for it. */
export function LoginVisual() {
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setShowVideo(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setShowVideo(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden p-12">
      {showVideo && (
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster="/logo.png"
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src="/login-visual.mp4" type="video/mp4" />
        </video>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/55" aria-hidden="true" />

      <Link href="/" className="relative z-10 flex items-center gap-2">
        <div className="relative h-7 w-7 shrink-0">
          <Image src="/logo.png" alt="Vatsa AI" fill className="object-contain" sizes="28px" />
        </div>
        <span className="text-sm font-semibold text-white">Vatsa AI</span>
      </Link>

      <div className="relative z-10 flex items-end justify-between gap-6">
        <div>
          <h1 className="max-w-md text-4xl font-bold leading-tight text-white lg:text-5xl">
            Unlock the power of AI
          </h1>
          <p className="mt-3 max-w-sm text-base text-gray-300">
            Chat with the smartest AI. Build faster with Vatsa AI.
          </p>
        </div>
        <span className="hidden shrink-0 text-xs text-gray-400 xl:block">Intelligence, orchestrated.</span>
      </div>
    </div>
  );
}
