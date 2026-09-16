"use client";

import { type RefObject } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Send, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageActions } from "@/components/code/MessageActions";
import type { ChatMessage } from "@/services/chat";
import { MODELS } from "@/types/code";

interface CodeChatPanelProps {
  widthPercent: number;
  messages: ChatMessage[];
  isLoading: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  inputValue: string;
  setInputValue: (v: string) => void;
  onInputKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  model: string;
  setModel: (m: string) => void;
  sendMessage: (content: string) => void;
  stopGeneration: () => void;
  notify: (message: string, kind?: "success" | "error" | "info") => void;
  editUserMessage: (msg: ChatMessage) => void;
  regenerateLast: () => void;
}

export function CodeChatPanel({
  widthPercent, messages, isLoading, messagesEndRef,
  inputValue, setInputValue, onInputKeyDown, model, setModel,
  sendMessage, stopGeneration, notify, editUserMessage, regenerateLast,
}: CodeChatPanelProps) {
  return (
    <div
      className="flex h-full flex-col border-r border-border/40 bg-background/20"
      style={{ width: `${widthPercent}%` }}
    >
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          const isLastAssistant = !isUser && i === messages.length - 1;
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("group flex", isUser ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[90%] break-words rounded-2xl px-3 py-2 text-sm",
                  isUser
                    ? "bg-accent/20 text-foreground"
                    : "border border-border/20 bg-card/80 text-foreground"
                )}
                data-no-focus
              >
                {isUser ? (
                  msg.content
                ) : (
                  <div className="prose prose-sm prose-invert max-w-none prose-pre:bg-black/40 prose-pre:text-xs prose-code:text-xs">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
                <MessageActions
                  content={msg.content}
                  onCopy={() => notify("Copied", "success")}
                  showEdit={isUser}
                  onEdit={() => editUserMessage(msg)}
                  onRegenerate={isLastAssistant ? regenerateLast : undefined}
                />
              </div>
            </motion.div>
          );
        })}
        {isLoading && (
          <div className="flex items-center gap-1.5 text-muted-foreground/40">
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent/50" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent/50 [animation-delay:0.2s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-accent/50 [animation-delay:0.4s]" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border/40 bg-background/40 p-2">
        <div className="flex items-end gap-2 rounded-2xl border border-border/50 bg-card/80 p-1.5 transition-all focus-within:border-accent/50">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Describe what to build…"
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/30"
            style={{ minHeight: 32, maxHeight: 120 }}
          />
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            aria-label="Model"
            className="rounded-md border border-border/60 bg-background/60 px-1.5 py-1 text-[10px] text-muted-foreground outline-none focus:border-accent/50"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          {isLoading ? (
            <button
              onClick={stopGeneration}
              aria-label="Stop"
              className="rounded-full bg-red-500/80 p-1.5 text-white hover:scale-105"
            >
              <StopCircle className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => {
                if (inputValue.trim()) sendMessage(inputValue);
              }}
              disabled={!inputValue.trim()}
              aria-label="Send"
              className="rounded-full bg-accent p-1.5 text-accent-foreground hover:scale-105 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
