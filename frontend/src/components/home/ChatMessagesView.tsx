"use client";

import { type RefObject } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Paperclip, Globe, Mic, Send, Square, Copy, RefreshCw, ThumbsUp, ThumbsDown, Share2, Check, Brain, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import Magnetic from "@/components/landing/Magnetic";
import { Tooltip } from "@/components/home/Tooltip";
import { AttachmentChip } from "@/components/home/AttachmentChip";
import { AttachmentMenu } from "@/components/home/AttachmentMenu";
import { ImageLoadingGrid } from "@/components/home/ImageLoadingGrid";
import { SourcesList } from "@/components/home/SourcesList";
import { ThinkingBox } from "@/components/home/ThinkingBox";
import { linkifyCitations } from "@/lib/home/citations";
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
}

export function ChatMessagesView({
  messages, isLoading, isImageGenLoading, copiedMsgId, feedback,
  onCopy, onRegenerate, onFeedback, onShare,
  messagesEndRef, chatContainerRef,
  attachments, removeAttachment, onAnalyzeImage, analyzingImageId,
  inputRef, inputValue, onInputChange, onSend, onStop, hasReadyAttachments,
  showAttachmentMenu, setShowAttachmentMenu, webSearchEnabled, onToggleWebSearch,
  reasoningEnabled, onToggleReasoning,
  banner, isFree,
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
              const msgAttachments = (msg as any).attachments || [];
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[450px] rounded-[18px] bg-[#1B1B1B] px-4 py-2.5 text-sm text-foreground" style={{ wordBreak: "break-word" }}>
                    {msgAttachments.length > 0 && (
                      <div className="mb-1 flex flex-wrap gap-1">
                        {msgAttachments.map((a: any, i: number) => (
                          <span key={i} className="text-[10px] bg-white/10 rounded px-1.5 py-0.5">📎 {a.name}</span>
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
            const msgImageUrl = (msg as any).imageUrl as string | undefined;
            return (
              <div key={msg.id} className="flex flex-col items-start gap-1 group">
                <span className="text-xs font-medium text-muted-foreground/60">Vatsa AI</span>

                {msgImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={msgImageUrl}
                    alt="generated"
                    className="my-3 rounded-xl max-w-full shadow-lg"
                    style={{ maxWidth: 420 }}
                    loading="lazy"
                  />
                )}

                <ThinkingBox thinking={msg.thinking} isStreaming={msg.isStreaming} />

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
                                <button
                                  onClick={() => navigator.clipboard.writeText(String(children).replace(/\n$/, ''))}
                                  className="p-1 rounded bg-black/20 hover:bg-black/40 text-white/60 hover:text-white"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
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
                      }}
                    >
                      {linkifyCitations(msg.content, msg.sources)}
                    </ReactMarkdown>
                  </div>
                )}

                <SourcesList sources={msg.sources} />

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                  <Tooltip text={isCopied ? "Copied!" : "Copy"}>
                    <button
                      onClick={() => onCopy(msg.id, msg.content)}
                      className={cn(
                        "p-1 rounded hover:bg-accent/10 transition-colors",
                        isCopied ? "text-green-500" : "text-muted-foreground/60 hover:text-foreground"
                      )}
                    >
                      {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </Tooltip>
                  <Tooltip text="Regenerate">
                    <button
                      onClick={() => onRegenerate(msg.id)}
                      disabled={isLoading}
                      className="p-1 rounded hover:bg-accent/10 text-muted-foreground/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={cn("w-4 h-4", isLoading && msgIdx === messages.length - 1 && "animate-spin")} />
                    </button>
                  </Tooltip>
                  <Tooltip text="Good Response">
                    <button
                      onClick={() => onFeedback(msg.id, "up")}
                      className={cn(
                        "p-1 rounded hover:bg-accent/10 transition-colors",
                        fb === "up" ? "text-green-500" : "text-muted-foreground/60 hover:text-foreground"
                      )}
                    >
                      <ThumbsUp className={cn("w-4 h-4", fb === "up" && "fill-current")} />
                    </button>
                  </Tooltip>
                  <Tooltip text="Bad Response">
                    <button
                      onClick={() => onFeedback(msg.id, "down")}
                      className={cn(
                        "p-1 rounded hover:bg-accent/10 transition-colors",
                        fb === "down" ? "text-red-500" : "text-muted-foreground/60 hover:text-foreground"
                      )}
                    >
                      <ThumbsDown className={cn("w-4 h-4", fb === "down" && "fill-current")} />
                    </button>
                  </Tooltip>
                  <Tooltip text="Share">
                    <button
                      onClick={() => onShare(msg.content)}
                      className="p-1 rounded hover:bg-accent/10 text-muted-foreground/60 hover:text-foreground"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex flex-col items-start gap-2">
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

      <div className="border-t border-border/40 bg-background/60 px-4 py-3 backdrop-blur-sm">
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

          <div className="flex items-end gap-2 rounded-2xl border border-border/50 bg-card/80 p-2 shadow-sm focus-within:border-accent/50">
            <div className="relative">
              <Tooltip text="Attach File">
                <button onClick={() => setShowAttachmentMenu((p) => !p)} className="p-2 hover:bg-accent/10 rounded-full transition-colors">
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
              placeholder={`Message Vatsa AI... (${modKey}+Enter)`}
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              style={{ minHeight: "40px", maxHeight: "200px", overflow: "auto" }}
            />

            <div className="flex items-center gap-1">
              <Tooltip text={webSearchEnabled ? "Web search on" : "Search Web"}>
                <button
                  onClick={onToggleWebSearch}
                  className={`rounded-full p-2 hover:bg-accent/10 ${webSearchEnabled ? "bg-accent/20 text-accent" : "bg-accent/5 text-muted-foreground"}`}
                >
                  <Globe className="h-4 w-4" />
                </button>
              </Tooltip>
              <Tooltip text={isFree ? "Reasoning is a Pro feature" : reasoningEnabled ? "Reasoning on" : "Show step-by-step reasoning"}>
                <button
                  onClick={onToggleReasoning}
                  className={`relative rounded-full p-2 hover:bg-accent/10 ${reasoningEnabled ? "bg-accent/20 text-accent" : "bg-accent/5 text-muted-foreground"}`}
                >
                  <Brain className="h-4 w-4" />
                  {isFree && <Lock className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-background text-muted-foreground" />}
                </button>
              </Tooltip>
              <Tooltip text={isFree ? "Voice is a Pro feature" : "Voice Chat"}>
                <button className="relative rounded-full bg-accent/5 p-2 text-muted-foreground hover:bg-accent/10">
                  <Mic className="h-4 w-4" />
                  {isFree && <Lock className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-background text-muted-foreground" />}
                </button>
              </Tooltip>
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
                  className={cn(
                    "rounded-full p-2 text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                    isLoading || inputValue.trim() || hasReadyAttachments ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
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
