// src/app/page.tsx
"use client";

import React from "react";
import { useCallback, useEffect, useMemo, useRef, useState, memo, Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  Archive, BookOpen, Copy, ExternalLink,
  Settings, Plus, X, Search,
  RefreshCw, Loader, Paperclip, FolderOpen,
  PanelLeft, MessageSquare, Pencil, Pin, Star, Trash2,
  MoreHorizontal, Globe, Mic, Send, Square,
  Terminal, Bug, Image as ImageIcon,
  Code, Zap, Brain, Sparkles, Database,
  Shield, Lock, LogOut, CheckCircle2,
  AlertCircle, Info, Palette, Languages,
  Share2, ThumbsUp, ThumbsDown,
  Download, Check,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import type { Message, Conversation } from "@/types";

const CommandPalette = dynamic(
  () => import("@/components/layout/command-palette").then(mod => mod.CommandPalette),
  { ssr: false }
);
const ToastContainer = dynamic(
  () => import("@/components/ui/toast").then(mod => mod.ToastContainer),
  { ssr: false }
);

import Background from "@/components/landing/Background";
import Magnetic from "@/components/landing/Magnetic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type ThemeMode = "dark" | "light" | "system";
type AccentColor = "default" | "blue" | "purple" | "green" | "orange";

type AttachmentStatus = "processing" | "ready" | "error";

type Attachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  isBase64: boolean;
  status: AttachmentStatus;
  preview?: string;
};

const isMac = typeof navigator !== "undefined" ? navigator.platform.toUpperCase().indexOf("MAC") >= 0 : false;
const MOD_KEY = isMac ? "⌘" : "Ctrl";

const isImageGenQuery = (text: string): boolean => {
  const t = text.toLowerCase().trim();
  if (!t) return false;
  return (
    /\b(generate|create|make|draw|paint|render|produce|design)\s+(an?\s+|me\s+)?(.{0,40}?)\s*(image|picture|photo|photograph|illustration|artwork|drawing|portrait|art)\b/.test(t) ||
    /\bimage\s+of\s+/.test(t) ||
    /\bpicture\s+of\s+/.test(t) ||
    /\bphoto\s+of\s+/.test(t) ||
    /^imagine\s+/.test(t) ||
    /^\/imagine\s+/.test(t)
  );
};

const Tooltip = memo(({ children, text, side = "bottom" }: { children: React.ReactNode; text: string; side?: "top" | "bottom" | "left" | "right" }) => {
  const [show, setShow] = useState(false);
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };
  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className={cn("absolute z-50 px-2 py-1 text-xs font-medium text-white bg-black rounded shadow-lg whitespace-nowrap pointer-events-none", positionClasses[side])}
        >
          {text}
        </motion.div>
      )}
    </div>
  );
});
Tooltip.displayName = "Tooltip";

const IconBtn = memo(({ children, tip, side = "bottom", onClick, className, disabled, active }: any) => (
  <Tooltip text={tip} side={side}>
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "focus-ring relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed",
        active && "bg-accent/10 text-foreground",
        className
      )}
    >
      {children}
    </button>
  </Tooltip>
));
IconBtn.displayName = "IconBtn";

const AttachmentMenu = memo(({ open, onClose, onFileUpload, onFolderUpload }: any) => {
  if (!open) return null;
  return (
    <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-border bg-background p-1.5 shadow-2xl z-50" onMouseLeave={onClose}>
      <button onClick={onFileUpload} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent/10 text-sm text-foreground/80">
        <Paperclip className="w-4 h-4 text-muted-foreground" /> Upload File
      </button>
      <button onClick={onFolderUpload} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent/10 text-sm text-foreground/80">
        <FolderOpen className="w-4 h-4 text-muted-foreground" /> Upload Folder
      </button>
    </div>
  );
});
AttachmentMenu.displayName = "AttachmentMenu";

const ToolbarPopover = memo(({ open, onClose, title, children }: any) => {
  if (!open) return null;
  return (
    <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl border border-border bg-background p-3 shadow-2xl z-50" onMouseLeave={onClose}>
      <h4 className="text-sm font-medium text-foreground mb-2">{title}</h4>
      {children}
    </div>
  );
});
ToolbarPopover.displayName = "ToolbarPopover";

const DeleteConfirmModal = memo(({ open, onClose, onConfirm }: any) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-background rounded-2xl border border-border p-6 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-foreground">Delete conversation?</h3>
        <p className="text-sm text-muted-foreground mt-1">This action cannot be undone.</p>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-accent/10 text-sm">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm">Delete</button>
        </div>
      </motion.div>
    </div>
  );
});
DeleteConfirmModal.displayName = "DeleteConfirmModal";

const RenameModal = memo(({ open, onClose, onRename, currentTitle }: any) => {
  const [value, setValue] = useState(currentTitle || "");
  useEffect(() => {
    setValue(currentTitle || "");
  }, [currentTitle, open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-background rounded-2xl border border-border p-6 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-foreground">Rename conversation</h3>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-3 w-full rounded-xl border border-border bg-input/10 px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") { onRename(value); onClose(); } }}
        />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-accent/10 text-sm">Cancel</button>
          <button onClick={() => { onRename(value); onClose(); }} className="flex-1 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm">Rename</button>
        </div>
      </motion.div>
    </div>
  );
});
RenameModal.displayName = "RenameModal";

const AttachmentChip = memo(({ file, onRemove }: { file: Attachment; onRemove: (id: string) => void }) => (
  <div className="group flex items-center gap-2 rounded-lg border border-border bg-card/70 px-2 py-1.5 text-xs max-w-[220px]">
    {file.preview ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={file.preview} alt={file.name} className="h-8 w-8 rounded object-cover" />
    ) : (
      <div className="flex h-8 w-8 items-center justify-center rounded bg-accent/10">
        <Paperclip className="h-4 w-4 text-accent" />
      </div>
    )}
    <div className="min-w-0 flex-1">
      <p className="truncate font-medium text-foreground">{file.name}</p>
      <p className="text-[10px] text-muted-foreground">
        {file.status === "processing" && "Processing…"}
        {file.status === "ready" && `${(file.size / 1024).toFixed(1)} KB`}
        {file.status === "error" && "Failed"}
      </p>
    </div>
    <button
      onClick={() => onRemove(file.id)}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  </div>
));
AttachmentChip.displayName = "AttachmentChip";

const ImageLoadingGrid = memo(() => {
  const phrases = [
    "Twinning pixels…",
    "Sketching shapes…",
    "Blending colors…",
    "Almost there…",
    "Adding final touches…",
    "Polishing details…",
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % phrases.length), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-2xl bg-accent/[0.06] p-3 w-full max-w-[320px]">
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 16 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0.1 }}
              animate={{ opacity: [0.1, 0.55, 0.1] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: (i % 4) * 0.12 + Math.floor(i / 4) * 0.08,
              }}
              className="aspect-square rounded-md bg-gradient-to-br from-accent/50 to-accent/10"
            />
          ))}
        </div>

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
          {[0, 1, 2].map((d) => (
            <motion.span
              key={d}
              animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.15, 0.85] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.18, ease: "easeInOut" }}
              className="block w-1.5 h-1.5 rounded-full bg-accent"
            />
          ))}
        </div>
      </div>

      <motion.p
        key={idx}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xs text-muted-foreground/70 flex items-center gap-2"
      >
        <Loader className="w-3 h-3 animate-spin" />
        {phrases[idx]}
      </motion.p>
    </div>
  );
});
ImageLoadingGrid.displayName = "ImageLoadingGrid";

async function readFileAsAttachment(file: File): Promise<Attachment> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  const isTextLike =
    file.type.startsWith("text/") ||
    /(json|xml|javascript|typescript|csv|yaml|yml|markdown)$/i.test(file.type) ||
    /\.(txt|md|markdown|json|js|jsx|ts|tsx|py|java|c|cpp|h|hpp|cs|go|rs|rb|php|html|htm|css|scss|sass|xml|yaml|yml|csv|tsv|log|sh|bash|zsh|sql|kt|swift|dart|r|m|pl|lua|vue|svelte)$/i.test(file.name);

  return new Promise<Attachment>((resolve) => {
    const reader = new FileReader();
    const base: Omit<Attachment, "content" | "isBase64" | "status"> = {
      id, name: file.name, type: file.type || "application/octet-stream", size: file.size,
    };
    if (isTextLike && !isImage && !isPdf) {
      reader.onload = () => resolve({ ...base, content: String(reader.result || ""), isBase64: false, status: "ready" });
      reader.onerror = () => resolve({ ...base, content: "", isBase64: false, status: "error" });
      reader.readAsText(file);
      return;
    }
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      resolve({ ...base, content: dataUrl, isBase64: true, status: "ready", preview: isImage ? dataUrl : undefined });
    };
    reader.onerror = () => resolve({ ...base, content: "", isBase64: true, status: "error" });
    reader.readAsDataURL(file);
  });
}

const normalizeConv = (c: any): Conversation => {
  const id = c?.id ?? c?.conversation_id ?? c?._id;
  return {
    ...c,
    id: String(id),
    title: c?.title || "New Chat",
    messages: Array.isArray(c?.messages) ? c.messages : [],
    updatedAt: c?.updatedAt || c?.updated_at || c?.createdAt || new Date().toISOString(),
    pinned: !!c?.pinned,
    favorite: !!c?.favorite,
    archived: !!c?.archived,
  } as Conversation;
};

const dedupeConversations = (convs: Conversation[]): Conversation[] => {
  const map = new Map<string, Conversation>();
  convs.forEach(c => map.set(String(c.id), { ...c, id: String(c.id) } as Conversation));
  return Array.from(map.values());
};

const Sidebar = memo(({
  onNewChat, onOpenSettings, conversations, collapsed, toggleSidebar, width,
  privateMode, onDeleteChat, onLogout, userProfile, onRenameChat, onPinChat,
  onUnpinChat, onToggleFavorite, onDuplicateChat, onArchiveChat,
  activeConversationId, setActiveConversation,
}: any) => {
  const [query, setQuery] = useState("");
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);
  const [showMenuFor, setShowMenuFor] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);

  const convList = Array.isArray(conversations) ? conversations : [];

  const filtered = useMemo(() => {
    let list = convList.filter((c: any) => !c.archived);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c: any) => {
        if (c.title?.toLowerCase().includes(q)) return true;
        if (c.messages && c.messages.some((m: any) => m.content?.toLowerCase().includes(q))) return true;
        return false;
      });
    }
    return [...list].sort((a: any, b: any) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });
  }, [convList, query]);

  const handleDelete = useCallback((id: string) => setDeleteTargetId(id), []);
  const confirmDelete = useCallback(() => {
    if (deleteTargetId) { onDeleteChat(deleteTargetId); setDeleteTargetId(null); setShowMenuFor(null); }
  }, [deleteTargetId, onDeleteChat]);
  const handleRename = useCallback((id: string) => setRenameTargetId(id), []);
  const handleRenameSubmit = useCallback((newTitle: string) => {
    if (renameTargetId) { onRenameChat(renameTargetId, newTitle); setRenameTargetId(null); setShowMenuFor(null); }
  }, [renameTargetId, onRenameChat]);

  const isCollapsed = collapsed;
  const targetConv = renameTargetId ? convList.find((c: any) => String(c.id) === String(renameTargetId)) : null;

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 60 : width }}
        transition={{ type: "spring", stiffness: 420, damping: 40 }}
        className="relative hidden h-full shrink-0 flex-col border-r border-border bg-sidebar md:flex"
      >
        <div className="flex h-full flex-col">
          <div className={cn("flex items-center gap-2 px-3 pt-4", isCollapsed && "flex-col")}>
            {!isCollapsed ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="relative w-7 h-7 rounded-full overflow-hidden">
                  <Image
                    src="/logo.png"
                    alt="Vatsa AI"
                    width={28}
                    height={28}
                    className="object-cover rounded-full"
                    style={{ width: 28, height: 28 }}
                    priority
                    onError={(e) => {
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        const fallback = document.createElement('div');
                        fallback.className = 'flex items-center justify-center w-full h-full bg-accent/20 text-accent-foreground font-bold rounded-full text-sm';
                        fallback.textContent = 'V';
                        parent.appendChild(fallback);
                        e.currentTarget.style.display = 'none';
                      }
                    }}
                  />
                </div>
                <span className="truncate text-[16px] font-semibold tracking-tight text-foreground">Vatsa AI</span>
              </div>
            ) : (
              <div className="relative w-7 h-7 rounded-full overflow-hidden">
                <Image
                  src="/logo.png"
                  alt="Vatsa AI"
                  width={28}
                  height={28}
                  className="object-cover rounded-full"
                  style={{ width: 28, height: 28 }}
                  priority
                  onError={(e) => {
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      const fallback = document.createElement('div');
                      fallback.className = 'flex items-center justify-center w-full h-full bg-accent/20 text-accent-foreground font-bold rounded-full text-sm';
                      fallback.textContent = 'V';
                      parent.appendChild(fallback);
                      e.currentTarget.style.display = 'none';
                    }
                  }}
                />
              </div>
            )}
            <IconBtn tip={isCollapsed ? "Expand sidebar" : "Collapse sidebar"} side={isCollapsed ? "right" : "bottom"} onClick={toggleSidebar} className="hidden md:inline-flex">
              <PanelLeft className="h-[18px] w-[18px]" />
            </IconBtn>
            <IconBtn tip="Close" onClick={() => {}} className="md:hidden"><X className="h-[18px] w-[18px]" /></IconBtn>
          </div>

          <div className={cn("px-3 pt-3", isCollapsed && "px-2")}>
            {isCollapsed ? (
              <IconBtn tip="New Chat" side="right" onClick={onNewChat} className="h-9 w-9"><Plus className="h-5 w-5" /></IconBtn>
            ) : (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onNewChat} className="flex w-full items-center gap-2 rounded-xl border border-border bg-accent/5 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/10">
                <Plus className="h-4 w-4" /> New Chat <kbd className="ml-auto text-[10px] text-muted-foreground">⌘K</kbd>
              </motion.button>
            )}
          </div>

          {!isCollapsed && (
            <div className="px-3 pt-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search chats..."
                  className="w-full rounded-xl border border-border bg-input/10 py-2 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none"
                />
                {query && <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
              </div>
            </div>
          )}

          <div className="scroll-thin mt-3 flex-1 overflow-y-auto px-2 min-h-0">
            {!isCollapsed ? (
              <div className="space-y-0.5">
                {!privateMode ? (
                  filtered.length > 0 ? (
                    filtered.map((c: any) => (
                      <div
                        key={c.id}
                        className={cn(
                          "group relative flex cursor-pointer items-center rounded-lg px-2.5 py-[6px] text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground",
                          String(activeConversationId) === String(c.id) && "bg-accent/10 text-foreground"
                        )}
                        onMouseEnter={() => setHoveredChatId(c.id)}
                        onMouseLeave={() => setHoveredChatId(null)}
                        onClick={() => setActiveConversation?.(c.id)}
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 mr-2 opacity-40" />
                        <span className="truncate">{c.title || "Untitled"}</span>
                        {c.pinned && <Pin className="h-3 w-3 ml-1 text-accent" />}
                        {c.favorite && <Star className="h-3 w-3 ml-1 text-yellow-400 fill-yellow-400" />}
                        <span className="ml-auto text-[10px] text-muted-foreground/50">
                          {new Date(c.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        {hoveredChatId === c.id && (
                          <button
                            className="ml-auto rounded-md p-1 hover:bg-accent/20"
                            onClick={(e) => { e.stopPropagation(); setShowMenuFor(showMenuFor === c.id ? null : c.id); }}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        )}
                        {showMenuFor === c.id && (
                          <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-xl border border-border bg-background shadow-lg p-1">
                            <button onClick={() => { setShowMenuFor(null); handleRename(c.id); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/10">
                              <Pencil className="w-3.5 h-3.5" /> Rename
                            </button>
                            <button onClick={() => { setShowMenuFor(null); onDuplicateChat(c.id); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/10">
                              <Copy className="w-3.5 h-3.5" /> Duplicate
                            </button>
                            <button onClick={() => { setShowMenuFor(null); onArchiveChat(c.id); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/10">
                              <Archive className="w-3.5 h-3.5" /> Archive
                            </button>
                            <button onClick={() => { setShowMenuFor(null); handleDelete(c.id); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-red-500 hover:bg-red-500/10">
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                            <hr className="my-1 border-border" />
                            {c.pinned ? (
                              <button onClick={() => { setShowMenuFor(null); onUnpinChat(c.id); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/10">
                                <Pin className="w-3.5 h-3.5" /> Unpin
                              </button>
                            ) : (
                              <button onClick={() => { setShowMenuFor(null); onPinChat(c.id); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/10">
                                <Pin className="w-3.5 h-3.5" /> Pin
                              </button>
                            )}
                            <button onClick={() => { setShowMenuFor(null); onToggleFavorite(c.id); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/10">
                              <Star className="w-3.5 h-3.5" /> {c.favorite ? "Unfavorite" : "Favorite"}
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                      <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
                      <p className="text-sm font-medium text-foreground/70">No conversations yet</p>
                      <p className="text-xs text-muted-foreground/60">Start a new chat to begin</p>
                    </div>
                  )
                ) : (
                  <div className="px-2.5 py-2 text-xs text-muted-foreground italic">Private mode – history disabled</div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 pt-1">
                {!privateMode &&
                  filtered.slice(0, 5).map((c: any) => (
                    <IconBtn key={c.id} tip={c.title || "Chat"} side="right" className="h-9 w-9" onClick={() => setActiveConversation?.(c.id)}>
                      <MessageSquare className="h-4 w-4" />
                    </IconBtn>
                  ))}
              </div>
            )}
          </div>

          <div className="border-t border-border px-2 py-2">
            {!isCollapsed ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/5 transition-colors">
                  <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center text-accent-foreground text-sm font-medium">
                    {userProfile?.full_name?.[0] || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate leading-tight">{userProfile?.full_name || "User"}</p>
                    <p className="text-xs text-muted-foreground truncate">{userProfile?.email || "user@email.com"}</p>
                  </div>
                  <button onClick={onOpenSettings} className="p-1.5 rounded-lg hover:bg-accent/10 transition-colors text-muted-foreground hover:text-foreground">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 px-1">
                  <button onClick={onOpenSettings} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground">
                    <Settings className="w-3.5 h-3.5" /> Settings
                  </button>
                  <button onClick={onLogout} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-400/10 transition-colors">
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <IconBtn tip="Settings" side="right" className="h-9 w-9" onClick={onOpenSettings}><Settings className="h-4 w-4" /></IconBtn>
                <IconBtn tip="Sign Out" side="right" className="h-9 w-9" onClick={onLogout}><LogOut className="h-4 w-4" /></IconBtn>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      <DeleteConfirmModal open={!!deleteTargetId} onClose={() => setDeleteTargetId(null)} onConfirm={confirmDelete} />
      <RenameModal
        open={!!renameTargetId}
        onClose={() => setRenameTargetId(null)}
        onRename={handleRenameSubmit}
        currentTitle={targetConv?.title || ""}
      />
    </>
  );
});
Sidebar.displayName = "Sidebar";

const SettingsModal = memo(({ open, onClose, settings, updateSettings, onLogout, onClearAllChats, onExportChats }: any) => {
  const [activeTab, setActiveTab] = useState("general");
  const [lang, setLang] = useState(settings.language || "en");

  const languages = [
    { code: "en", label: "English" }, { code: "hi", label: "Hindi" }, { code: "bn", label: "Bengali" },
    { code: "ta", label: "Tamil" }, { code: "te", label: "Telugu" }, { code: "mr", label: "Marathi" },
    { code: "gu", label: "Gujarati" }, { code: "kn", label: "Kannada" }, { code: "ml", label: "Malayalam" },
    { code: "pa", label: "Punjabi" }, { code: "ur", label: "Urdu" }, { code: "es", label: "Spanish" },
    { code: "fr", label: "French" }, { code: "de", label: "German" }, { code: "pt", label: "Portuguese" },
    { code: "it", label: "Italian" }, { code: "nl", label: "Dutch" }, { code: "ru", label: "Russian" },
    { code: "ar", label: "Arabic" }, { code: "zh", label: "Chinese" }, { code: "ja", label: "Japanese" },
    { code: "ko", label: "Korean" }, { code: "id", label: "Indonesian" }, { code: "tr", label: "Turkish" },
    { code: "vi", label: "Vietnamese" }, { code: "th", label: "Thai" },
  ];

  const legalLinks = [
    { label: "About Vatsa AI", href: "/about" }, { label: "Contact", href: "/contact" },
    { label: "Privacy Policy", href: "/privacy" }, { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" }, { label: "Security", href: "/security" },
    { label: "Disclaimer", href: "/disclaimer" }, { label: "Refund Policy", href: "/refund" },
    { label: "Return Policy", href: "/return" },
  ];

  if (!open) return null;

  const tabs = [
    { id: "general", label: "General", icon: <Settings className="w-4 h-4" /> },
    { id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4" /> },
    { id: "language", label: "Language", icon: <Languages className="w-4 h-4" /> },
    { id: "legal", label: "Legal & Info", icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-background rounded-2xl border border-border w-[90vw] max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground hover:text-foreground" /></button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-40 border-r border-border p-2 space-y-1 overflow-y-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  activeTab === tab.id ? "bg-accent/10 text-foreground" : "text-muted-foreground hover:bg-accent/5 hover:text-foreground"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === "general" && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Font Size</label>
                  <div className="flex gap-2 mt-1">
                    {["small", "medium", "large"].map((size) => (
                      <button
                        key={size}
                        onClick={() => updateSettings({ fontSize: size })}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-sm transition-colors",
                          settings.fontSize === size ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted-foreground hover:bg-accent/5"
                        )}
                      >
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t border-border">
                  <button
                    onClick={() => { if (window.confirm("Delete all chats permanently?")) onClearAllChats(); }}
                    className="text-sm text-red-500 hover:underline"
                  >
                    Clear All Chats
                  </button>
                </div>
                <div>
                  <button onClick={onExportChats} className="text-sm text-accent hover:underline">
                    Export Chats (JSON)
                  </button>
                </div>
              </div>
            )}
            {activeTab === "appearance" && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Theme</label>
                  <div className="flex gap-2 mt-1">
                    {["dark", "light", "system"].map((t) => (
                      <button
                        key={t}
                        onClick={() => updateSettings({ theme: t })}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-sm transition-colors",
                          settings.theme === t ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted-foreground hover:bg-accent/5"
                        )}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Accent Color</label>
                  <div className="flex gap-2 mt-1">
                    {["default", "blue", "purple", "green", "orange"].map((color) => (
                      <button
                        key={color}
                        onClick={() => updateSettings({ accentColor: color })}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all",
                          settings.accentColor === color ? "border-accent scale-110" : "border-transparent"
                        )}
                        style={{ background: color === "default" ? "#a855f7" : color === "blue" ? "#3b82f6" : color === "purple" ? "#a855f7" : color === "green" ? "#10b981" : "#f97316" }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            {activeTab === "language" && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Interface Language</label>
                  <select
                    value={lang}
                    onChange={(e) => { const v = e.target.value; setLang(v); updateSettings({ language: v }); }}
                    className="mt-2 w-full rounded-xl border border-border bg-input/10 px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none"
                  >
                    {languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground/60 mt-1">Language preference is saved for future localization.</p>
                </div>
              </div>
            )}
            {activeTab === "legal" && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-2">Legal & Information</p>
                <div className="grid grid-cols-1 gap-1">
                  {legalLinks.map((link) => (
                    <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent/5 text-sm text-foreground/80 hover:text-foreground transition-colors">
                      <span>{link.label}</span>
                      <ExternalLink className="w-4 h-4 text-muted-foreground/50" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
});
SettingsModal.displayName = "SettingsModal";

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();

  const {
    sidebarCollapsed, draftMessage, scrollPosition, user, setUser,
    setSidebarCollapsed, setDraftMessage, setScrollPosition,
  } = useAppStore();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState(draftMessage || "");
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [accentColor, setAccentColor] = useState<"default" | "blue" | "purple" | "green" | "orange">("default");
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [privateMode, setPrivateMode] = useState(false);
  const [selectedModel, setSelectedModel] = useState("auto");
  const [currentWorkspace, setCurrentWorkspace] = useState("personal");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showShortcutHelper, setShowShortcutHelper] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [errorState, setErrorState] = useState<{ message: string; stack?: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showWebSearchPopover, setShowWebSearchPopover] = useState(false);
  const [showVoicePopover, setShowVoicePopover] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const creatingChatRef = useRef<Promise<string | null> | null>(null);

  const [isImageGenLoading, setIsImageGenLoading] = useState(false);

  const [feedback, setFeedback] = useState<Record<string, "up" | "down" | null>>({});
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const setLanguage = useCallback((lang: string) => { localStorage.setItem("vatsa-language", lang); }, []);

  const handleThemeChange = useCallback((newTheme: ThemeMode) => {
    setTheme(newTheme);
    localStorage.setItem("vatsa-theme", newTheme);
    if (newTheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    } else {
      document.documentElement.classList.toggle("dark", newTheme === "dark");
    }
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("vatsa-theme") as ThemeMode | null;
    if (savedTheme) handleThemeChange(savedTheme);
    const savedLang = localStorage.getItem("vatsa-language");
    if (savedLang) setLanguage(savedLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => document.documentElement.classList.toggle("dark", media.matches);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, [theme]);

  const activeConv = useMemo(() => {
    if (!Array.isArray(conversations)) return null;
    return conversations.find(c => String(c.id) === String(activeConversationId)) ?? null;
  }, [conversations, activeConversationId]);

  const messages = useMemo(() => activeConv?.messages || [], [activeConv]);

  const accentColorHex = useMemo(() => {
    switch (accentColor) {
      case "blue": return "#3b82f6";
      case "purple": return "#a855f7";
      case "green": return "#10b981";
      case "orange": return "#f97316";
      default: return "#a855f7";
    }
  }, [accentColor]);

  const fontSizePx = useMemo(() => {
    switch (fontSize) {
      case "small": return "14px";
      case "large": return "18px";
      default: return "16px";
    }
  }, [fontSize]);

  const updateConversation = useCallback((id: string, updater: (conv: Conversation) => Conversation) => {
    setConversations(prev => {
      const updated = prev.map(c => String(c.id) === String(id) ? updater(c) : c);
      return dedupeConversations(updated);
    });
  }, []);

  const addMessageToConversation = useCallback((convId: string, message: Message) => {
    updateConversation(convId, (conv) => ({
      ...conv,
      messages: [...(conv.messages || []), message],
      updatedAt: new Date().toISOString(),
    }));
  }, [updateConversation]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/auth/login"); return; }
    fetchProfileAndChats(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfileAndChats = useCallback(async (token: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const profileRes = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!profileRes.ok) {
        if (profileRes.status === 401) throw new Error("Unauthorized");
        throw new Error(`Profile fetch failed (${profileRes.status})`);
      }
      const profileData = await profileRes.json();
      setUser(profileData?.user ?? profileData);

      const convRes = await fetch(`${API_BASE}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!convRes.ok) throw new Error("Failed to fetch conversations");
      const raw = await convRes.json();
      const arr = Array.isArray(raw) ? raw : (raw?.conversations ?? raw?.data ?? []);
      const uniqueConvs = dedupeConversations(arr.map(normalizeConv));
      setConversations(uniqueConvs);

      setActiveConversationId(prev => prev ?? (uniqueConvs[0] ? String(uniqueConvs[0].id) : null));
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.message === "Unauthorized") {
        localStorage.removeItem("access_token");
        router.push("/auth/login");
      } else {
        setErrorState({ message: error.message || "Failed to load profile" });
      }
    } finally {
      setLoading(false);
    }
  }, [setUser, router]);

  const handleNewChat = useCallback(async (): Promise<string | null> => {
    if (creatingChatRef.current) return creatingChatRef.current;

    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/auth/login"); return null; }

    const task = (async (): Promise<string | null> => {
      try {
        const response = await fetch(`${API_BASE}/api/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: "New Chat" }),
        });
        const text = await response.text();
        if (!response.ok) throw new Error(text || `Failed (${response.status})`);

        let raw: any = {};
        try { raw = text ? JSON.parse(text) : {}; } catch { raw = {}; }
        const rawConv = raw?.conversation ?? raw?.data ?? raw;
        if (!rawConv || (rawConv.id ?? rawConv.conversation_id) == null) {
          throw new Error("Backend did not return valid conversation id");
        }
        const newConv = normalizeConv(rawConv);
        setConversations(prev => dedupeConversations([newConv, ...prev]));
        setActiveConversationId(String(newConv.id));
        setInputValue("");
        setDraftMessage("");
        setIsFirstMessage(true);
        requestAnimationFrame(() => inputRef.current?.focus());
        return String(newConv.id);
      } catch (error: any) {
        setErrorState({ message: error.message || "Could not create new chat" });
        return null;
      } finally {
        creatingChatRef.current = null;
      }
    })();

    creatingChatRef.current = task;
    return task;
  }, [router, setDraftMessage]);

  const handleDeleteChat = useCallback(async (id: string) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/conversations/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setConversations(prev => prev.filter(c => String(c.id) !== String(id)));
      if (String(activeConversationId) === String(id)) setActiveConversationId(null);
    } catch (error: any) {
      setErrorState({ message: error.message || "Failed to delete chat" });
    }
  }, [activeConversationId]);

  const handleClearAllChats = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/conversations`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setConversations([]);
      setActiveConversationId(null);
    } catch (error: any) {
      setErrorState({ message: error.message || "Failed to clear chats" });
    }
  }, []);

  const handleExportChats = useCallback(() => {
    if (!Array.isArray(conversations) || conversations.length === 0) return;
    const dataStr = JSON.stringify(conversations, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vatsa-chats-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [conversations]);

  const handleRenameChat = useCallback(async (id: string, title: string) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title }),
      });
      updateConversation(id, (conv) => ({ ...conv, title }));
    } catch (error: any) {
      setErrorState({ message: error.message || "Failed to rename chat" });
    }
  }, [updateConversation]);

  const handlePinChat = useCallback(async (id: string) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/conversations/${id}/pin`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      updateConversation(id, (conv) => ({ ...conv, pinned: true }));
    } catch {}
  }, [updateConversation]);

  const handleUnpinChat = useCallback(async (id: string) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/conversations/${id}/pin`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      updateConversation(id, (conv) => ({ ...conv, pinned: false }));
    } catch {}
  }, [updateConversation]);

  const handleToggleFavorite = useCallback(async (id: string) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    const conv = conversations.find(c => String(c.id) === String(id));
    if (!conv) return;
    try {
      await fetch(`${API_BASE}/api/conversations/${id}/favorite`, {
        method: conv.favorite ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      updateConversation(id, (c) => ({ ...c, favorite: !c.favorite }));
    } catch {}
  }, [conversations, updateConversation]);

  const handleDuplicateChat = useCallback(async (id: string) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/conversations/${id}/duplicate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Duplicate failed");
      const raw = await response.json();
      const rawConv = raw?.conversation ?? raw?.data ?? raw;
      const newConv = normalizeConv(rawConv);
      setConversations(prev => dedupeConversations([newConv, ...prev]));
    } catch {}
  }, []);

  const handleArchiveChat = useCallback(async (id: string) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/conversations/${id}/archive`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      updateConversation(id, (conv) => ({ ...conv, archived: true }));
    } catch {}
  }, [updateConversation]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed(!sidebarCollapsed);
  }, [sidebarCollapsed, setSidebarCollapsed]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("access_token");
    setUser(null);
    router.push("/auth/login");
  }, [router, setUser]);

  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), []);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom || isLoading) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages.length, isLoading, isImageGenLoading]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setDraftMessage(value);
    const target = e.target;
    target.style.height = "auto";
    target.style.height = Math.min(target.scrollHeight, 300) + "px";
  }, [setDraftMessage]);

  const handleCopy = useCallback(async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId((v) => (v === msgId ? null : v)), 1500);
    } catch (e) { console.error("Copy failed:", e); }
  }, []);

  const handleFeedback = useCallback((msgId: string, dir: "up" | "down") => {
    setFeedback((prev) => ({ ...prev, [msgId]: prev[msgId] === dir ? null : dir }));
  }, []);

  const handleRegenerate = useCallback(async (msgId: string) => {
    if (isLoading || !activeConversationId) return;
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx < 1) return;
    const prevUser = [...messages.slice(0, idx)].reverse().find((m) => m.role === "user");
    if (!prevUser) return;

    updateConversation(activeConversationId, (conv) => ({
      ...conv,
      messages: (conv.messages || []).filter((_, i) => i < idx),
    }));

    await sendMessage(prevUser.content);
  }, [isLoading, activeConversationId, messages, updateConversation]);

  const handleShare = useCallback(async (content: string) => {
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title: "Vatsa AI", text: content });
      } else {
        await navigator.clipboard.writeText(content);
      }
    } catch {}
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    const hasAttachments = attachments.some(a => a.status === "ready");
    if (!content.trim() && !hasAttachments) return;

    if (isLoading) {
      abortControllerRef.current?.abort();
      setIsLoading(false);
      setIsImageGenLoading(false);
      return;
    }

    const willGenImage = isImageGenQuery(content) && !hasAttachments;

    let convId = activeConversationId;
    if (!convId) {
      const newId = await handleNewChat();
      if (!newId) return;
      convId = newId;
    }

    const conv = conversations.find(c => String(c.id) === String(convId));
    const isFirst = !!conv && (conv.messages?.length ?? 0) === 0 && (conv.title === "New Chat" || !conv.title);

    const readyAttachments = attachments.filter(a => a.status === "ready");
    const payloadAttachments = readyAttachments.map(a => ({
      name: a.name, type: a.type, size: a.size, is_base64: a.isBase64, content: a.content,
    }));

    let messageText = content.trim();
    const inlineText = readyAttachments
      .filter(a => !a.isBase64 && a.content)
      .map(a => `\n\n--- File: ${a.name} ---\n${a.content}`)
      .join("");
    if (inlineText) messageText = `${messageText}${inlineText}`.trim();

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim() || `📎 ${readyAttachments.map(a => a.name).join(", ")}`,
      createdAt: new Date().toISOString(),
      // @ts-ignore
      attachments: payloadAttachments,
    };
    addMessageToConversation(convId, userMsg);
    setInputValue("");
    setDraftMessage("");
    setAttachments([]);

    if (isFirst) setIsFirstMessage(false);

    if (isFirst && !privateMode && content.trim()) {
      const newTitle = content.trim().slice(0, 35) + (content.trim().length > 35 ? "..." : "");
      if (newTitle !== "New Chat") await handleRenameChat(convId, newTitle);
    }

    setIsLoading(true);
    if (willGenImage) setIsImageGenLoading(true);
    abortControllerRef.current = new AbortController();

    const token = localStorage.getItem("access_token");
    const userId = user?.email || `user_${Date.now()}`;

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          message: messageText,
          userId: userId,
          conversation_id: convId,
          userTier: "free",
          attachments: payloadAttachments,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // 🔥 Extract image separately — ReactMarkdown `data:` URLs block karta hai
      let imageUrl: string | undefined = data.image_url;
      let textContent: string = data.response || "No response from AI";

      if (!imageUrl && textContent) {
        const m = textContent.match(/!\[[^\]]*\]\((data:image\/[^)\s]+|https?:\/\/[^)\s]+)\)/);
        if (m) {
          imageUrl = m[1];
          textContent = textContent
            .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
            .replace(/\*\*Vatsa AI Image\*\*/g, "")
            .replace(/\*\*Generated Image\*\*/g, "")
            .trim();
        }
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: textContent || (imageUrl ? "" : "No response from AI"),
        createdAt: new Date().toISOString(),
        model: data.selected_model || "Vatsa AI",
        // @ts-ignore
        imageUrl,
      };
      addMessageToConversation(convId, assistantMsg);
      setErrorState(null);
    } catch (error: any) {
      if (error.name === "AbortError") {
        addMessageToConversation(convId, {
          id: Date.now().toString(), role: "assistant",
          content: "⏹️ Generation stopped.", createdAt: new Date().toISOString(),
        });
        setErrorState(null);
      } else {
        addMessageToConversation(convId, {
          id: (Date.now() + 1).toString(), role: "assistant",
          content: `⚠️ Failed: ${error.message || "Unknown error"}`,
          createdAt: new Date().toISOString(),
        });
        setErrorState({ message: error.message || "Unknown error", stack: error.stack });
      }
    } finally {
      setIsLoading(false);
      setIsImageGenLoading(false);
    }
  }, [
    activeConversationId, conversations, privateMode, user, attachments,
    isLoading, addMessageToConversation, handleRenameChat, handleNewChat, setDraftMessage,
  ]);

  const handleRetry = useCallback(() => {
    if (messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
      if (lastUserMsg) { sendMessage(lastUserMsg.content); setErrorState(null); }
    }
  }, [messages, sendMessage]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setShowAttachmentMenu(false);
    const fileArr = Array.from(files);

    const placeholders: Attachment[] = fileArr.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name, type: f.type || "application/octet-stream", size: f.size,
      content: "", isBase64: false, status: "processing",
    }));
    setAttachments((prev) => [...prev, ...placeholders]);

    try {
      const results = await Promise.all(fileArr.map(readFileAsAttachment));
      setAttachments((prev) => {
        const cleaned = prev.filter(
          (p) => !(p.status === "processing" && results.some((r) => r.name === p.name))
        );
        return [...cleaned, ...results];
      });
    } catch (err) {
      setAttachments((prev) => prev.map(p => p.status === "processing" ? { ...p, status: "error" } : p));
    } finally {
      e.target.value = "";
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "k") { e.preventDefault(); document.dispatchEvent(new CustomEvent("vatsa-command-palette")); }
      if (e.key === "?" && !ctrl) { e.preventDefault(); setShowShortcutHelper(true); }
      if (ctrl && e.key === "b") { e.preventDefault(); handleToggleSidebar(); }
      if (ctrl && e.key === "j") { e.preventDefault(); setIsNotificationCenterOpen((p) => !p); }
      if (ctrl && e.key === "Enter") { e.preventDefault(); if (inputValue.trim()) sendMessage(inputValue); }
      if (ctrl && e.key === "n") { e.preventDefault(); handleNewChat(); }
      if (ctrl && e.key === ",") { e.preventDefault(); setIsSettingsOpen(true); }
      if (ctrl && e.key === "u") { e.preventDefault(); fileInputRef.current?.click(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [inputValue, sendMessage, handleNewChat, handleToggleSidebar]);

  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  useEffect(() => {
    if (activeConv && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [activeConversationId]);

  useEffect(() => {
    const handleScroll = () => {
      if (chatContainerRef.current) setScrollPosition(chatContainerRef.current.scrollTop);
    };
    const container = chatContainerRef.current;
    container?.addEventListener("scroll", handleScroll);
    return () => container?.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
  }, []);

  const chatSuggestions = [
    { label: "Build a Website", icon: <Code className="w-4 h-4" /> },
    { label: "Write Code", icon: <Terminal className="w-4 h-4" /> },
    { label: "Generate Image", icon: <ImageIcon className="w-4 h-4" /> },
    { label: "Fix Bug", icon: <Bug className="w-4 h-4" /> },
    { label: "Explain Anything", icon: <BookOpen className="w-4 h-4" /> },
    { label: "Research Topic", icon: <Search className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 animate-spin text-purple-500" />
          <p className="text-sm text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  const isEmpty = !activeConv || (activeConv.messages?.length ?? 0) === 0;
  const hasReadyAttachments = attachments.some(a => a.status === "ready");

  return (
    <>
      <Background />
      <main
        suppressHydrationWarning
        className={cn("relative z-10 min-h-screen overflow-hidden transition-colors duration-300", theme === "dark" ? "dark" : "light")}
        style={{ fontSize: fontSizePx, "--accent": accentColorHex } as React.CSSProperties}
      >
        {privateMode && (
          <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 bg-accent/10 backdrop-blur-sm border border-accent/20 text-accent-foreground rounded-full px-4 py-1 text-xs font-medium flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Private Mode Enabled
            <span className="text-[10px] opacity-70 ml-1">— History Disabled · No Storage</span>
          </div>
        )}

        <div className="relative z-10 flex h-screen flex-col">
          <header className="flex h-9 shrink-0 items-center justify-between px-4 backdrop-blur-sm bg-background/40 border-b border-border/40">
            <div className="w-8" />
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-md border border-border/60 bg-black/20 p-0.5">
                <button onClick={() => router.push("/")} className={cn("px-3 py-1 text-xs font-medium rounded transition-all duration-150", pathname === "/" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-foreground")}>Chat</button>
                <button onClick={() => router.push("/code")} className={cn("px-3 py-1 text-xs font-medium rounded transition-all duration-150", pathname === "/code" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-foreground")}>Code</button>
              </div>
              {privateMode && (<div className="flex items-center gap-1 text-xs text-accent font-medium"><Lock className="w-3 h-3" /> Private</div>)}
            </div>
            <div className="flex items-center gap-1" />
          </header>

          <div className="flex flex-1 overflow-hidden">
            <Sidebar
              mobileOpen={isSidebarOpen}
              onCloseMobile={() => setIsSidebarOpen(false)}
              onNewChat={handleNewChat}
              onOpenSettings={handleOpenSettings}
              conversations={conversations}
              collapsed={sidebarCollapsed}
              toggleSidebar={handleToggleSidebar}
              width={sidebarWidth}
              setSidebarWidth={setSidebarWidth}
              privateMode={privateMode}
              onDeleteChat={handleDeleteChat}
              onLogout={handleLogout}
              userProfile={user}
              onRenameChat={handleRenameChat}
              onPinChat={handlePinChat}
              onUnpinChat={handleUnpinChat}
              onToggleFavorite={handleToggleFavorite}
              onDuplicateChat={handleDuplicateChat}
              onArchiveChat={handleArchiveChat}
              activeConversationId={activeConversationId}
              setActiveConversation={setActiveConversationId}
            />

            <div className="flex-1 overflow-y-auto bg-background/40 backdrop-blur-sm">
              {isEmpty ? (
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
                      {chatSuggestions.map((item) => (
                        <button
                          key={item.label}
                          className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/5 hover:border-accent/20"
                          onClick={() => { setInputValue(item.label + " "); setDraftMessage(item.label + " "); }}
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
                            {attachments.map((a) => (<AttachmentChip key={a.id} file={a} onRemove={removeAttachment} />))}
                          </div>
                        )}

                        <div className="relative">
                          <textarea
                            ref={inputRef}
                            value={inputValue}
                            onChange={handleInputChange}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                if (inputValue.trim() || hasReadyAttachments) sendMessage(inputValue);
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
                              <Tooltip text="Search Web">
                                <button onClick={() => setShowWebSearchPopover((p) => !p)} className="flex items-center gap-1 rounded-full bg-accent/5 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground">
                                  <Globe className="h-4 w-4" /> Search
                                </button>
                              </Tooltip>
                              <ToolbarPopover open={showWebSearchPopover} onClose={() => setShowWebSearchPopover(false)} title="Web Search">
                                <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent/10 rounded">Enable Search</button>
                              </ToolbarPopover>
                            </div>
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
                                  onClick={() => { if (inputValue.trim() || hasReadyAttachments) sendMessage(inputValue); }}
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
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />
                      <input type="file" ref={folderInputRef} onChange={handleFileUpload} className="hidden" multiple />
                    </motion.div>

                    <div className="mt-4 text-center text-xs text-muted-foreground/60">
                      Vatsa AI can make mistakes. Check important info.
                    </div>
                  </div>
                </div>
              ) : (
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

                            {/* 🎨 IMAGE — direct <img> to bypass ReactMarkdown data: URL block */}
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
                                  }}
                                >
                                  {msg.content}
                                </ReactMarkdown>
                              </div>
                            )}

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                              <Tooltip text={isCopied ? "Copied!" : "Copy"}>
                                <button
                                  onClick={() => handleCopy(msg.id, msg.content)}
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
                                  onClick={() => handleRegenerate(msg.id)}
                                  disabled={isLoading}
                                  className="p-1 rounded hover:bg-accent/10 text-muted-foreground/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <RefreshCw className={cn("w-4 h-4", isLoading && msgIdx === messages.length - 1 && "animate-spin")} />
                                </button>
                              </Tooltip>
                              <Tooltip text="Good Response">
                                <button
                                  onClick={() => handleFeedback(msg.id, "up")}
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
                                  onClick={() => handleFeedback(msg.id, "down")}
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
                                  onClick={() => handleShare(msg.content)}
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
                    <div className="mx-auto max-w-[760px]">
                      {attachments.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {attachments.map((a) => (<AttachmentChip key={a.id} file={a} onRemove={removeAttachment} />))}
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
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />
                          <input type="file" ref={folderInputRef} onChange={handleFileUpload} className="hidden" multiple />
                        </div>

                        <textarea
                          ref={inputRef}
                          value={inputValue}
                          onChange={handleInputChange}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (inputValue.trim() || hasReadyAttachments) sendMessage(inputValue);
                              else if (isLoading) { abortControllerRef.current?.abort(); setIsLoading(false); setIsImageGenLoading(false); }
                            }
                          }}
                          placeholder={`Message Vatsa AI... (${MOD_KEY}+Enter)`}
                          rows={1}
                          className="flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
                          style={{ minHeight: "40px", maxHeight: "200px", overflow: "auto" }}
                        />

                        <div className="flex items-center gap-1">
                          <Tooltip text="Search Web">
                            <button className="rounded-full bg-accent/5 p-2 text-muted-foreground hover:bg-accent/10"><Globe className="h-4 w-4" /></button>
                          </Tooltip>
                          <Tooltip text="Voice Chat">
                            <button className="rounded-full bg-accent/5 p-2 text-muted-foreground hover:bg-accent/10"><Mic className="h-4 w-4" /></button>
                          </Tooltip>
                        </div>

                        <Magnetic strength={0.25}>
                          <Tooltip text={isLoading ? "Stop Generation" : "Send Message"}>
                            <motion.button
                              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                if (isLoading) { abortControllerRef.current?.abort(); setIsLoading(false); setIsImageGenLoading(false); }
                                else if (inputValue.trim() || hasReadyAttachments) sendMessage(inputValue);
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
              )}
            </div>
          </div>

          <Suspense fallback={null}><CommandPalette /></Suspense>
          <Suspense fallback={null}><ToastContainer /></Suspense>

          {isNotificationCenterOpen && (
            <div className="fixed top-12 right-4 z-50 w-80 rounded-2xl border border-border bg-background/90 p-4 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">Notifications</h3>
                <button onClick={() => setIsNotificationCenterOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="space-y-2 max-h-60 overflow-auto">
                <div className="flex gap-2 text-sm p-2 rounded hover:bg-accent/5">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-foreground/80">Welcome to Vatsa AI</span>
                </div>
              </div>
            </div>
          )}

          <SettingsModal
            open={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={{
              language: typeof window !== "undefined" ? (localStorage.getItem("vatsa-language") || "en") : "en",
              currentWorkspace, theme, accentColor, fontSize, selectedModel, privateMode,
              smartRouter: true, searchEnabled: true, shareData: false,
            }}
            updateSettings={(updates: any) => {
              if (updates.theme) handleThemeChange(updates.theme);
              if (updates.accentColor) setAccentColor(updates.accentColor);
              if (updates.fontSize) setFontSize(updates.fontSize);
              if (updates.privateMode !== undefined) setPrivateMode(updates.privateMode);
              if (updates.language) { setLanguage(updates.language); localStorage.setItem("vatsa-language", updates.language); }
            }}
            onLogout={handleLogout}
            onClearAllChats={handleClearAllChats}
            onExportChats={handleExportChats}
          />

          {showShortcutHelper && (
            <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center" onClick={() => setShowShortcutHelper(false)}>
              <div className="bg-background rounded-xl border border-border p-5 w-80 max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-foreground">Keyboard Shortcuts</h3>
                  <button onClick={() => setShowShortcutHelper(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘K</kbd><span className="text-muted-foreground">Command Palette</span></div>
                  <div className="flex justify-between"><kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘B</kbd><span className="text-muted-foreground">Toggle Sidebar</span></div>
                  <div className="flex justify-between"><kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘N</kbd><span className="text-muted-foreground">New Chat</span></div>
                  <div className="flex justify-between"><kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘,</kbd><span className="text-muted-foreground">Settings</span></div>
                  <div className="flex justify-between"><kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘Enter</kbd><span className="text-muted-foreground">Send Message</span></div>
                </div>
              </div>
            </div>
          )}

          {errorState && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-destructive/10 border border-destructive/30 text-destructive-foreground rounded-lg p-3 shadow-lg flex items-center gap-3 backdrop-blur-sm">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{errorState.message}</span>
              <div className="flex gap-2">
                <button onClick={handleRetry} className="bg-destructive/20 px-2 py-1 rounded text-xs">Retry</button>
                <button onClick={() => setErrorState(null)} className="bg-destructive/20 px-2 py-1 rounded text-xs">Dismiss</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}