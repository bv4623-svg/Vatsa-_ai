"use client";

import { type RefObject } from "react";
import { motion } from "framer-motion";
import { Paperclip, Globe, Mic, Send, Code, Terminal, Image as ImageIcon, Bug, BookOpen, Search, Brain } from "lucide-react";
import Magnetic from "@/components/landing/Magnetic";
import { Tooltip } from "@/components/home/Tooltip";
import { AttachmentChip } from "@/components/home/AttachmentChip";
import { AttachmentMenu } from "@/components/home/AttachmentMenu";
import { ToolbarPopover } from "@/components/home/ToolbarPopover";
import type { Attachment } from "@/types/home";

const CHAT_SUGGESTIONS = [
  { label: "Build a Website", icon: <Code className="w-4 h-4" /> },
  { label: "Write Code", icon: <Terminal className="w-4 h-4" /> },
  { label: "Generate Image", icon: <ImageIcon className="w-4 h-4" /> },
  { label: "Fix Bug", icon: <Bug className="w-4 h-4" /> },
  { label: "Explain Anything", icon: <BookOpen className="w-4 h-4" /> },
  { label: "Research Topic", icon: <Search className="w-4 h-4" /> },
];

interface ChatEmptyStateProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  inputValue: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSuggestionClick: (label: string) => void;
  onSend: () => void;
  hasReadyAttachments: boolean;
  attachments: Attachment[];
  removeAttachment: (id: string) => void;
  onAnalyzeImage?: (file: Attachment) => void;
  analyzingImageId?: string | null;
  showAttachmentMenu: boolean;
  setShowAttachmentMenu: (v: boolean | ((p: boolean) => boolean)) => void;
  showWebSearchPopover: boolean;
  setShowWebSearchPopover: (v: boolean | ((p: boolean) => boolean)) => void;
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
  reasoningEnabled: boolean;
  onToggleReasoning: () => void;
  showVoicePopover: boolean;
  setShowVoicePopover: (v: boolean | ((p: boolean) => boolean)) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ChatEmptyState({
  inputRef, inputValue, onInputChange, onSuggestionClick, onSend, hasReadyAttachments,
  attachments, removeAttachment, onAnalyzeImage, analyzingImageId,
  showAttachmentMenu, setShowAttachmentMenu,
  showWebSearchPopover, setShowWebSearchPopover, webSearchEnabled, onToggleWebSearch,
  reasoningEnabled, onToggleReasoning,
  showVoicePopover, setShowVoicePopover,
  fileInputRef, folderInputRef, onFileUpload,
}: ChatEmptyStateProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-[760px]">
        <motion.div
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
          className="mb-6 text-center"
        >
          <h2 className="text-2xl font-medium text-foreground">
            Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 18 ? "Afternoon" : "Evening"}
          </h2>
          <p className="mt-1 text-base text-muted-foreground">What would you like to build today?</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.15 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-3"
        >
          {CHAT_SUGGESTIONS.map((item) => (
            <button
              key={item.label}
              className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/5 hover:border-accent/20"
              onClick={() => onSuggestionClick(item.label + " ")}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.15 }}
          className="relative mt-6"
        >
          <div className="rounded-2xl border border-border/50 bg-card/80 shadow-sm p-4 transition-all hover:border-border">
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

            <div className="relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={onInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (inputValue.trim() || hasReadyAttachments) onSend();
                  }
                }}
                placeholder="Ask Vatsa AI anything..."
                rows={1}
                className="w-full resize-none bg-transparent text-lg text-foreground outline-none placeholder:text-muted-foreground/50 md:text-xl"
                style={{ minHeight: "120px", maxHeight: "300px", overflow: "auto" }}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/30 pt-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Tooltip text="Attach File">
                  <button onClick={() => setShowAttachmentMenu((p) => !p)} className="flex items-center gap-1 rounded-full bg-accent/5 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground">
                    <Paperclip className="h-4 w-4" /> Attach
                  </button>
                </Tooltip>
                <div className="relative">
                  <Tooltip text={webSearchEnabled ? "Web search on" : "Search Web"}>
                    <button
                      onClick={() => setShowWebSearchPopover((p) => !p)}
                      className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-accent/10 hover:text-foreground ${webSearchEnabled ? "bg-accent/20 text-accent" : "bg-accent/5 text-muted-foreground"}`}
                    >
                      <Globe className="h-4 w-4" /> Search
                    </button>
                  </Tooltip>
                  <ToolbarPopover open={showWebSearchPopover} onClose={() => setShowWebSearchPopover(false)} title="Web Search">
                    <button onClick={onToggleWebSearch} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent/10 rounded">
                      {webSearchEnabled ? "Disable Search" : "Enable Search"}
                    </button>
                  </ToolbarPopover>
                </div>
                <Tooltip text={reasoningEnabled ? "Reasoning on" : "Show step-by-step reasoning"}>
                  <button
                    onClick={onToggleReasoning}
                    className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-accent/10 hover:text-foreground ${reasoningEnabled ? "bg-accent/20 text-accent" : "bg-accent/5 text-muted-foreground"}`}
                  >
                    <Brain className="h-4 w-4" /> Think
                  </button>
                </Tooltip>
                <div className="relative">
                  <Tooltip text="Voice Chat">
                    <button onClick={() => setShowVoicePopover((p) => !p)} className="flex items-center gap-1 rounded-full bg-accent/5 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground">
                      <Mic className="h-4 w-4" /> Voice
                    </button>
                  </Tooltip>
                  <ToolbarPopover open={showVoicePopover} onClose={() => setShowVoicePopover(false)} title="Voice Input">
                    <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent/10 rounded">Start Recording</button>
                  </ToolbarPopover>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Magnetic strength={0.25}>
                  <Tooltip text="Send Message">
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={onSend}
                      disabled={!inputValue.trim() && !hasReadyAttachments}
                      className="h-11 w-11 rounded-full bg-accent text-accent-foreground shadow-sm transition-all hover:shadow-accent/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <Send className="h-5 w-5" />
                    </motion.button>
                  </Tooltip>
                </Magnetic>
              </div>
            </div>
          </div>

          <AttachmentMenu
            open={showAttachmentMenu}
            onClose={() => setShowAttachmentMenu(false)}
            onFileUpload={() => fileInputRef.current?.click()}
            onFolderUpload={() => folderInputRef.current?.click()}
          />
          <input type="file" ref={fileInputRef} onChange={onFileUpload} className="hidden" multiple />
          <input type="file" ref={folderInputRef} onChange={onFileUpload} className="hidden" multiple />
        </motion.div>

        <div className="mt-4 text-center text-xs text-muted-foreground/60">
          Vatsa AI can make mistakes. Check important info.
        </div>
      </div>
    </div>
  );
}
