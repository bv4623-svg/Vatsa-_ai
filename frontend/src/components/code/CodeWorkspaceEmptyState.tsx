"use client";

import { useState, useEffect, useMemo, type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Globe, Code, Folder, Bug, BookOpen, Monitor,
  PlusCircle, Mic, Sparkles,
} from "lucide-react";
import type { ProjectFile } from "@/types/code";
import { AIIcon } from "@/components/brand/AIIcon";

const QUICK_SUGGESTIONS = [
  { label: "Build a website", icon: <Globe className="h-4 w-4" /> },
  { label: "Create a React component", icon: <Code className="h-4 w-4" /> },
  { label: "Write an API server", icon: <Folder className="h-4 w-4" /> },
  { label: "Fix a bug", icon: <Bug className="h-4 w-4" /> },
  { label: "Explain code", icon: <BookOpen className="h-4 w-4" /> },
  { label: "Design a dashboard", icon: <Monitor className="h-4 w-4" /> },
];

function useSuggestionsCarousel(paused: boolean, active: boolean) {
  const allSuggestions = useMemo(() => {
    const actions = ["Build","Create","Design","Develop","Write","Implement","Deploy","Optimize","Refactor","Test","Launch","Scale"];
    const topics = ["website","web app","mobile app","API","dashboard","component","tool","system","platform","SaaS"];
    const techs = ["React","Next.js","TypeScript","Node.js","Python","FastAPI","PostgreSQL","Redis","Docker","Tailwind","GraphQL","Prisma","Supabase"];
    const specifics = ["authentication","payment integration","real-time chat","data visualization","analytics","AI integration","search","recommendation engine","serverless"];

    const hand = [
      "Build a full-stack Next.js app with authentication",
      "Create a real-time chat app with Socket.io",
      "Design a modern dashboard with shadcn/ui",
      "Develop a REST API with FastAPI and PostgreSQL",
      "Build a SaaS platform with Razorpay payments",
      "Create an AI-powered chatbot with streaming",
      "Design a responsive e-commerce site with Next.js",
      "Build a mobile app with React Native and Firebase",
      "Create a collaborative whiteboard app",
    ];

    const out = new Set<string>(hand);
    for (let i = 0; out.size < 60 && i < 500; i++) {
      const a = actions[(Math.random() * actions.length) | 0];
      const t = topics[(Math.random() * topics.length) | 0];
      const tech = techs[(Math.random() * techs.length) | 0];
      const sp = specifics[(Math.random() * specifics.length) | 0];
      out.add(`${a} a ${t} with ${tech} and ${sp}`);
    }
    return Array.from(out);
  }, []);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (paused || active) return;
    const t = setInterval(
      () => setIndex((i) => (i + 1) % allSuggestions.length),
      4000
    );
    return () => clearInterval(t);
  }, [allSuggestions.length, paused, active]);

  return { current: allSuggestions[index] || "", index };
}

interface CodeWorkspaceEmptyStateProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  inputValue: string;
  setInputValue: (v: string) => void;
  isLoading: boolean;
  onInputKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  sendMessage: (content: string) => void;
  notify: (message: string, kind?: "success" | "error" | "info") => void;
  onFileAttached: (file: ProjectFile) => void;
}

export function CodeWorkspaceEmptyState({
  inputRef, inputValue, setInputValue, isLoading, onInputKeyDown,
  sendMessage, notify, onFileAttached,
}: CodeWorkspaceEmptyStateProps) {
  const [carouselPaused, setCarouselPaused] = useState(false);
  const { current: currentSuggestion, index: suggestionIndex } =
    useSuggestionsCarousel(carouselPaused, Boolean(inputValue));

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const handleAttachFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".html,.css,.js,.ts,.tsx,.jsx,.json,.md,.py,.txt";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result;
        if (typeof content === "string") {
          onFileAttached({ name: file.name, content });
          notify(`Attached ${file.name}`, "success");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleVoiceInput = () => {
    const W = window as any;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) {
      notify("Voice input not supported in this browser.", "error");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputValue(transcript);
      inputRef.current?.focus();
    };
    rec.start();
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-3xl space-y-8 text-center"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.1, type: "spring" }}
          className="relative mx-auto h-48 w-48 md:h-56 md:w-56"
        >
          <div className="absolute inset-0 animate-pulse rounded-full bg-accent/20 blur-3xl" />
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-accent/10 via-transparent to-accent/5 p-2">
            <AIIcon size={120} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="space-y-2"
        >
          <p className="text-sm text-muted-foreground/60">{greeting}</p>
          <h2 className="bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
            What would you like to build today?
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          onMouseEnter={() => setCarouselPaused(true)}
          onMouseLeave={() => setCarouselPaused(false)}
          className="relative"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={suggestionIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-center gap-3"
            >
              <Sparkles className="h-5 w-5 flex-shrink-0 text-accent/60" />
              <span className="text-xl font-medium text-foreground/80 md:text-2xl">
                {currentSuggestion}
              </span>
              <Sparkles className="h-5 w-5 flex-shrink-0 text-accent/60" />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-2 flex flex-wrap items-center justify-center gap-2"
        >
          {QUICK_SUGGESTIONS.map((s) => (
            <motion.button
              key={s.label}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setInputValue(s.label);
                inputRef.current?.focus();
              }}
              className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm transition-all hover:border-accent/20 hover:bg-accent/5 hover:text-foreground"
            >
              {s.icon}
              {s.label}
            </motion.button>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="relative mt-4"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-border/50 bg-card/80 p-2 shadow-xl backdrop-blur-sm transition-all focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/30">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Describe what you want to build…"
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/30"
              style={{ overflow: "auto" }}
            />
            <div className="flex items-center gap-1">
              <button
                onClick={handleAttachFile}
                aria-label="Attach file"
                className="rounded p-1 text-muted-foreground/60 hover:bg-accent/10 hover:text-foreground"
              >
                <PlusCircle className="h-4 w-4" />
              </button>
              <button
                onClick={handleVoiceInput}
                aria-label="Voice input"
                className="rounded p-1 text-muted-foreground/60 hover:bg-accent/10 hover:text-foreground"
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => {
                if (inputValue.trim()) sendMessage(inputValue);
              }}
              disabled={!inputValue.trim() || isLoading}
              aria-label="Send"
              className="rounded-full bg-accent p-2.5 text-accent-foreground transition-transform hover:scale-105 disabled:opacity-40"
            >
              {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground/40">
            Vatsa AI can make mistakes. Check important info.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
