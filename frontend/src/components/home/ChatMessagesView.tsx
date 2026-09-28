"use client";

import { type RefObject } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Paperclip, Globe, Send, Square, Copy, RefreshCw, ThumbsUp, ThumbsDown, Share2, Check, Brain, Lock, Volume2, RotateCcw, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Magnetic from "@/components/landing/Magnetic";
import { Tooltip } from "@/components/home/Tooltip";
import { AttachmentChip } from "@/components/home/AttachmentChip";
import { AttachmentMenu } from "@/components/home/AttachmentMenu";
import { ImageLoadingGrid } from "@/components/home/ImageLoadingGrid";
import { SourcesList } from "@/components/home/SourcesList";
import { CodeCopyButton } from "@/components/home/CodeCopyButton";
import { ThinkingBox } from "@/components/home/ThinkingBox";
import { linkifyCitations } from "@/lib/home/citations";
import {
  ResearchToggle, VoiceButton, VoiceConversationButton, VoiceStatus,
  type ComposerResearchProps, type ComposerVoiceProps,
} from "@/components/home/ComposerExtras";
import { ChatImage } from "@/components/home/ChatImage";
import { RelativeTime } from "@/components/home/RelativeTime";
import { MessageCounter } from "@/components/home/MessageCounter";
import type { Message } from "@/types";
import type { Attachment } from "@/types/home";

interface ChatMessagesViewProps {
  messages: Message[];
  isLoading: boolean;
  isImageGenLoading: boolean;
  copiedMsgId: string | null;
  feedback: Record<string, "up" | "down" | null>;
  onCopy: (msgId: string, content: string) => void;
  onRegenerate: (msgId: string) => void;
  onFeedback: (msgId: string, dir: "up" | "down") => void;
  onShare: (content: string) => void;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  chatContainerRef: RefObject<HTMLDivElement | null>;
  attachments: Attachment[];
  removeAttachment: (id: string) => void;
  onAnalyzeImage?: (file: Attachment) => void;
  analyzingImageId?: string | null;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  inputValue: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStop: () => void;
  hasReadyAttachments: boolean;
  showAttachmentMenu: boolean;
  setShowAttachmentMenu: (v: boolean | ((p: boolean) => boolean)) => void;
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
  reasoningEnabled: boolean;
  onToggleReasoning: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  modKey: string;
  banner?: React.ReactNode;
  isFree?: boolean;
  voice: ComposerVoiceProps;
  research: ComposerResearchProps;
  /** Read-aloud (text-to-speech); omitted when the browser can't speak. */
  onReadAloud?: (msgId: string, content: string) => void;
  speakingMsgId?: string | null;
  onRetry?: () => void;
}

export function ChatMessagesView({
  messages, isLoading, isImageGenLoading, copiedMsgId, feedback,
  onCopy, onRegenerate, onFeedback, onShare,
  messagesEndRef, chatContainerRef,
  attachments, removeAttachment, onAnalyzeImage, analyzingImageId,
  inputRef, inputValue, onInputChange, onSend, onStop, hasReadyAttachments,
  showAttachmentMenu, setShowAttachmentMenu, webSearchEnabled, onToggleWebSearch,
  reasoningEnabled, onToggleReasoning,
  banner, isFree, voice, research, onReadAloud, speakingMsgId, onRetry,
  fileInputRef, folderInputRef, onFileUpload,
  modKey,
}: ChatMessagesViewProps) {
  return (
    <div className="flex h-full flex-col">
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-[760px] space-y-6">
          {messages.map((msg, msgIdx) => {
            const isUser = msg.role === "user";
            if (isUser) {
              const msgAttachments = msg.attachments || [];
              return (
                <div key={msg.id} className="group relative flex justify-end">
                  <RelativeTime
                    date={msg.createdAt}
                    className="pointer-events-none absolute -bottom-5 right-2 text-[11px] text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                  <div className="max-w-[450px] rounded-[18px] bg-zinc-100 dark:bg-[#1B1B1B] px-4 py-2.5 text-sm text-foreground" style={{ wordBreak: "break-word" }}>
                    {msgAttachments.length > 0 && (
                      <div className="mb-1 flex flex-wrap gap-1">
                        {msgAttachments.map((a, i) => (
                          <span key={i} className="text-[10px] bg-black/5 dark:bg-white/10 rounded px-1.5 py-0.5">📎 {a.name}</span>
                        ))}
                      </div>
                    )}
                    {msg.content}
                  </div>
                </div>
              );
            }
            const isCopied = copiedMsgId === msg.id;
            const fb = feedback[msg.id] || null;
            const msgImageUrl = msg.imageUrl;
            const isLast = msgIdx === messages.length - 1;
            return (
              <div key={msg.id} className="flex flex-col items-start gap-1 group">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/60">
                  Vatsa AI
                  <RelativeTime date={msg.createdAt} className="font-normal before:mr-1.5 before:content-['·']" />
                </span>

                {msgImageUrl && (
                  <ChatImage src={msgImageUrl} alt="Generated image" className="my-3 max-w-[420px] rounded-xl shadow-lg" />
                )}

                {msg.researchStatus && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> {msg.researchStatus}
                  </p>
                )}

                <ThinkingBox thinking={msg.thinking} isStreaming={msg.isStreaming} />

                {msg.notice && (
                  <p className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-500" role="note">
                    <Info className="h-3.5 w-3.5 shrink-0" aria-hidden /> {msg.notice}
                  </p>
                )}

                {msg.content && (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 leading-relaxed">
                    <ReactMarkdown
                      components={{
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          const isBlock = Boolean(match || String(children).includes('\n'));
                          return isBlock ? (
                            <div className="relative">
                              <div className="absolute top-2 right-2 flex gap-1">
                                <CodeCopyButton text={String(children).replace(/\n$/, '')} />
                              </div>
                              <code className={className} {...props}>{children}</code>
                            </div>
                          ) : (
                            <code className={className} {...props}>{children}</code>
                          );
                        },
                        a({ href, children }) {
                          return (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                              {children}
                            </a>
                          );
                        },
                        img({ src, alt }) {
                          return <ChatImage src={typeof src === "string" ? src : undefined} alt={alt} />;
                        },
                      }}
                    >
                      {linkifyCitations(msg.content, msg.sources)}
                    </ReactMarkdown>
                  </div>
                )}

                <SourcesList sources={msg.sources} />

                {msg.isError && isLast && onRetry && !isLoading && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-1 flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 text-xs text-foreground hover:bg-accent/10"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try again
                  </button>
                )}

                {/* Always visible on touch screens (no hover there). */}
                <div className="mt-1 flex items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                  {onReadAloud && msg.content && !msg.isStreaming && (
                    <Tooltip text={speakingMsgId === msg.id ? "Stop reading" : "Read aloud"}>
                      <button
                        type="button"
                        onClick={() => onReadAloud(msg.id, msg.content)}
                        aria-label={speakingMsgId === msg.id ? "Stop reading aloud" : "Read aloud"}
                        aria-pressed={speakingMsgId === msg.id}
                        className={cn(
                          "tap-target p-1 rounded hover:bg-accent/10 transition-colors",
                          speakingMsgId === msg.id ? "text-accent" : "text-muted-foreground/60 hover:text-foreground"
                        )}
                      >
                        {speakingMsgId === msg.id ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip text={isCopied ? "Copied!" : "Copy"}>
                    <button
                      onClick={() => onCopy(msg.id, msg.content)}
                      aria-label={isCopied ? "Copied" : "Copy"}
                      className={cn(
                        "tap-target p-1 rounded hover:bg-accent/10 transition-colors",
                        isCopied ? "text-green-500" : "text-muted-foreground/60 hover:text-foreground"
                      )}
                    >
                      {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </Tooltip>
                  <Tooltip text="Regenerate">
                    <button
                      onClick={() => onRegenerate(msg.id)}
                      aria-label="Regenerate"
                      disabled={isLoading}
                      className="tap-target p-1 rounded hover:bg-accent/10 text-muted-foreground/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={cn("w-4 h-4", isLoading && isLast && "animate-spin")} />
                    </button>
                  </Tooltip>
                  <Tooltip text="Good Response">
                    <button
                      onClick={() => onFeedback(msg.id, "up")}
                      aria-label="Good response"
                      aria-pressed={fb === "up"}
                      className={cn(
                        "tap-target p-1 rounded hover:bg-accent/10 transition-colors",
                        fb === "up" ? "text-green-500" : "text-muted-foreground/60 hover:text-foreground"
                      )}
                    >
                      <ThumbsUp className={cn("w-4 h-4", fb === "up" && "fill-current")} />
                    </button>
                  </Tooltip>
                  <Tooltip text="Bad Response">
                    <button
                      onClick={() => onFeedback(msg.id, "down")}
                      aria-label="Bad response"
                      aria-pressed={fb === "down"}
                      className={cn(
                        "tap-target p-1 rounded hover:bg-accent/10 transition-colors",
                        fb === "down" ? "text-red-500" : "text-muted-foreground/60 hover:text-foreground"
                      )}
                    >
                      <ThumbsDown className={cn("w-4 h-4", fb === "down" && "fill-current")} />
                    </button>
                  </Tooltip>
                  <Tooltip text="Share">
                    <button
                      onClick={() => onShare(msg.content)}
                      aria-label="Share"
                      className="tap-target p-1 rounded hover:bg-accent/10 text-muted-foreground/60 hover:text-foreground"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex flex-col items-start gap-2" role="status" aria-label="Vatsa AI is responding">
              <span className="text-xs font-medium text-muted-foreground/60">Vatsa AI</span>
              {isImageGenLoading ? (
                <ImageLoadingGrid />
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-accent/50 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-accent/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 bg-accent/50 rounded-full animate-bounce [animation-delay:0.4s]" />
                  <span className="ml-1 text-muted-foreground/60 text-sm">▊</span>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom padding clears the iPhone home indicator (safe area). */}
      <div className="border-t border-border/40 bg-background/60 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        {banner}
        <div className="mx-auto max-w-[760px]">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <AttachmentChip
                  key={a.id} file={a} onRemove={removeAttachment}
                  onAnalyze={onAnalyzeImage} analyzing={analyzingImageId === a.id}
                />
              ))}
            </div>
          )}

          <VoiceStatus voice={voice} />
          <div className="relative flex items-end gap-2 rounded-2xl border border-border/50 bg-card/80 p-2 shadow-sm focus-within:border-accent/50">
            <MessageCounter length={inputValue.length} />
            <div className="relative">
              <Tooltip text="Attach File">
                <button onClick={() => setShowAttachmentMenu((p) => !p)} aria-label="Attach files" aria-haspopup="menu" aria-expanded={showAttachmentMenu} className="tap-target p-2 hover:bg-accent/10 rounded-full transition-colors">
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                </button>
              </Tooltip>
              <AttachmentMenu
                open={showAttachmentMenu}
                onClose={() => setShowAttachmentMenu(false)}
                onFileUpload={() => fileInputRef.current?.click()}
                onFolderUpload={() => folderInputRef.current?.click()}
              />
              <input type="file" ref={fileInputRef} onChange={onFileUpload} className="hidden" multiple />
              <input type="file" ref={folderInputRef} onChange={onFileUpload} className="hidden" multiple />
            </div>

            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={onInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (inputValue.trim() || hasReadyAttachments) onSend();
                  else if (isLoading) onStop();
                }
              }}
              placeholder={research.enabled ? "Ask a research question…" : `Message Vatsa AI... (${modKey}+Enter)`}
              aria-label="Message"
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              style={{ minHeight: "40px", maxHeight: "200px", overflow: "auto" }}
            />

            <div className="flex items-center gap-1">
              <Tooltip text={webSearchEnabled ? "Web search on" : "Search Web"}>
                <button
                  onClick={onToggleWebSearch}
                  aria-label={webSearchEnabled ? "Web search on" : "Web search off"}
                  aria-pressed={webSearchEnabled}
                  className={`tap-target rounded-full p-2 hover:bg-accent/10 ${webSearchEnabled ? "bg-accent/20 text-accent" : "bg-accent/5 text-muted-foreground"}`}
                >
                  <Globe className="h-4 w-4" />
                </button>
              </Tooltip>
              <Tooltip text={isFree ? "Reasoning is a Pro feature" : reasoningEnabled ? "Reasoning on" : "Show step-by-step reasoning"}>
                <button
                  onClick={onToggleReasoning}
                  aria-label={isFree ? "Step-by-step reasoning (Pro feature)" : "Step-by-step reasoning"}
                  aria-pressed={reasoningEnabled}
                  className={`tap-target relative rounded-full p-2 hover:bg-accent/10 ${reasoningEnabled ? "bg-accent/20 text-accent" : "bg-accent/5 text-muted-foreground"}`}
                >
                  <Brain className="h-4 w-4" />
                  {isFree && <Lock className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-background text-muted-foreground" />}
                </button>
              </Tooltip>
              <ResearchToggle research={research} compact />
              <VoiceButton voice={voice} compact />
              <VoiceConversationButton voice={voice} compact />
            </div>

            <Magnetic strength={0.25}>
              <Tooltip text={isLoading ? "Stop Generation" : "Send Message"}>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (isLoading) onStop();
                    else if (inputValue.trim() || hasReadyAttachments) onSend();
                  }}
                  disabled={!isLoading && !inputValue.trim() && !hasReadyAttachments}
                  aria-label={isLoading ? "Stop generating" : "Send message"}
                  className={cn(
                    "tap-target rounded-full p-2 text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                    isLoading || inputValue.trim() || hasReadyAttachments ? "bg-accent-solid text-accent-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {isLoading ? <Square className="h-5 w-5" /> : <Send className="h-5 w-5" />}
                </motion.button>
              </Tooltip>
            </Magnetic>
          </div>
          <div className="mt-2 text-center text-xs text-muted-foreground/60">
            Vatsa AI can make mistakes. Check important info.
          </div>
        </div>
      </div>
    </div>
  );
}
