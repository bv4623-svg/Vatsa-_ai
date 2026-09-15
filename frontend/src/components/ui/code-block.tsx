"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
}

export function CodeBlock({ code, language = "text", showLineNumbers = true, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split("\n");

  return (
    <div className={cn("group relative rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <span className="text-xs text-zinc-400 font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
          aria-label="Copy code"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <pre ref={codeRef} className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="text-zinc-200 font-mono">
          {lines.map((line, i) => (
            <div key={i} className="flex">
              {showLineNumbers && (
                <span className="select-none text-zinc-600 w-8 shrink-0 text-right mr-4">{i + 1}</span>
              )}
              <span>{line}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
