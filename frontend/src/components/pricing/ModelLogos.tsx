"use client";

import Image from "next/image";

/** `white`: the artwork is white, so light mode inverts it to show on a
 * light background. */
export const modelLogos = [
  { name: "OpenAI", src: "/openai.png", white: true },
  { name: "Claude", src: "/claude-color.png" },
  { name: "Gemini", src: "/gemini-color.png" },
  { name: "DeepSeek", src: "/deepseek-color.png" },
  { name: "Mistral", src: "/mistral-color.png" },
  { name: "Perplexity", src: "/perplexity-color.png" },
  { name: "Grok", src: "/grok.png", white: true },
  { name: "Midjourney", src: "/midjourney.png", white: true },
  { name: "Poe", src: "/poe-color.png" },
  { name: "Qwen", src: "/qwen-color.png" },
  { name: "Ollama", src: "/ollama.png", white: true },
  { name: "Anthropic", src: "/anthropic.png", white: true },
];

export function ModelLogos() {
  return (
    <div className="scroll-reveal py-12">
      <h3 className="text-center text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-8">
        Powered by leading AI models
      </h3>
      <div className="flex flex-wrap items-center justify-center gap-8 gap-y-6 max-w-5xl mx-auto">
        {modelLogos.map((logo) => (
          <div key={logo.name} className="flex flex-col items-center gap-1">
            <div className={`h-10 w-16 relative grayscale hover:grayscale-0 transition-all duration-300 opacity-70 hover:opacity-100 ${logo.white ? "invert dark:invert-0" : ""}`}>
              <Image
                src={logo.src}
                alt={logo.name}
                fill
                className="object-contain"
                sizes="64px"
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {logo.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── VatsaMark (with logo.png) ──────────────────────────────────────
