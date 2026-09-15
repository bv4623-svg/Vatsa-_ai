// src/app/code/page.tsx
"use client";

import React, {
  useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  LogOut, AlertCircle, Send, Plus, Globe, RefreshCw, ExternalLink,
  Code, Folder, Bug, Download, Smartphone, Tablet, Monitor,
  PlusCircle, Mic, FileCode, BookOpen, Sparkles, PanelLeft, X,
  Search, Settings, Copy, Check, StopCircle, RotateCcw, Pencil,
  Command as CommandIcon, ChevronRight, ChevronDown, FolderOpen,
  File as FileIcon, History, Sun, Moon, Trash2, Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Background from "@/components/landing/Background";

/* ──────────────────────────────────────────────────────────────
   Types — kept local fallback in case @/types is incomplete
   ────────────────────────────────────────────────────────────── */
export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  model?: string;
}
export interface Conversation {
  id: string;
  title: string;
  workspace: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}
export interface UserProfile {
  full_name?: string;
  email?: string;
}
export interface ProjectFile {
  name: string;
  content: string;
  language?: string;
}

type ThemeMode = "dark" | "light" | "system";
type AccentColor = "default" | "blue" | "purple" | "green" | "orange";
type PreviewMode = "preview" | "code";
type Device = "desktop" | "tablet" | "mobile";

interface Toast {
  id: string;
  kind: "info" | "success" | "error";
  message: string;
}

/* ──────────────────────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────────────────────── */
const isMac =
  typeof navigator !== "undefined" &&
  navigator.platform.toUpperCase().indexOf("MAC") >= 0;
const MOD_KEY = isMac ? "⌘" : "Ctrl";
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const STORAGE_KEY = "vatsa-code-conversations-v1";
const TOKEN_KEY = "access_token";

const MODELS = [
  { id: "auto", label: "Auto (recommended)" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
] as const;

/* ──────────────────────────────────────────────────────────────
   Monaco (lazy)
   ────────────────────────────────────────────────────────────── */
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full animate-pulse flex-col bg-muted/20">
      <div className="h-8 border-b border-border/20 bg-muted/10" />
      <div className="flex-1 space-y-2 p-4">
        <div className="h-4 w-3/4 rounded bg-muted/30" />
        <div className="h-4 w-1/2 rounded bg-muted/30" />
        <div className="h-4 w-5/6 rounded bg-muted/30" />
        <div className="h-4 w-2/3 rounded bg-muted/30" />
      </div>
    </div>
  ),
});

/* ──────────────────────────────────────────────────────────────
   Utilities
   ────────────────────────────────────────────────────────────── */
function uid(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Extract ALL fenced code blocks from markdown, not just the first. */
function extractAllCodeBlocks(
  text: string
): { language: string; code: string; name: string }[] {
  const regex = /```(\w+)?\s*\n([\s\S]*?)```/g;
  const blocks: { language: string; code: string; name: string }[] = [];
  const seen = new Map<string, number>();

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const language = (match[1] || "txt").toLowerCase();
    const code = match[2].trim();
    if (!code) continue;

    const ext = {
      js: "js", javascript: "js", jsx: "jsx",
      ts: "ts", typescript: "ts", tsx: "tsx",
      html: "html", css: "css", scss: "scss",
      json: "json", python: "py", py: "py",
      go: "go", rust: "rs", java: "java",
      md: "md", markdown: "md", sql: "sql",
      sh: "sh", bash: "sh", yaml: "yml", yml: "yml",
    }[language] || language;

    const base = `file.${ext}`;
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    const name = count === 1 ? base : `file-${count}.${ext}`;

    blocks.push({ language, code, name });
  }
  return blocks;
}

/** Normalize any backend shape into { text, files }. */
function normalizeResponse(data: any): {
  text: string;
  files: ProjectFile[];
} {
  if (data == null) {
    return { text: "_Backend returned an empty response._", files: [] };
  }

  const rawFiles = data?.files || data?.file_list || data?.artifacts;
  if (Array.isArray(rawFiles) && rawFiles.length > 0) {
    const files = rawFiles
      .map((f: any) => ({
        name: f.path || f.name || f.filename || "index.html",
        content: typeof f.content === "string" ? f.content : f.code || "",
      }))
      .filter((f) => f.content.length > 0);
    return {
      text:
        data?.response ||
        data?.message ||
        `Generated ${files.length} file(s).`,
      files,
    };
  }

  const candidate =
    (typeof data === "string" && data) ||
    data?.response ||
    data?.content ||
    data?.message ||
    data?.text ||
    data?.answer;

  if (typeof candidate === "string" && candidate.trim()) {
    const blocks = extractAllCodeBlocks(candidate);
    if (blocks.length > 0) {
      return {
        text: candidate,
        files: blocks.map((b) => ({
          name: b.name,
          content: b.code,
          language: b.language,
        })),
      };
    }
    return { text: candidate, files: [] };
  }

  return {
    text:
      "**Backend response:**\n\n```json\n" +
      JSON.stringify(data, null, 2) +
      "\n```",
    files: [],
  };
}

/** Attach syntax hints to file names. */
function languageFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript",
    jsx: "javascript", html: "html", css: "css", json: "json",
    md: "markdown", py: "python", rs: "rust", go: "go",
    java: "java", sql: "sql", sh: "shell", yml: "yaml", yaml: "yaml",
  };
  return map[ext] || "plaintext";
}

/** Auto-resize a textarea to fit its content. */
function useAutoResize(
  ref: React.RefObject<HTMLTextAreaElement>,
  value: string,
  maxHeight = 200
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }, [value, ref, maxHeight]);
}

/* ──────────────────────────────────────────────────────────────
   Toast system
   ────────────────────────────────────────────────────────────── */
function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback(
    (message: string, kind: Toast["kind"] = "info") => {
      const id = uid("toast");
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(
        () => setToasts((t) => t.filter((x) => x.id !== id)),
        2800
      );
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  return { toasts, push, dismiss };
}

/* ──────────────────────────────────────────────────────────────
   Small primitives
   ────────────────────────────────────────────────────────────── */
const Tooltip = ({
  children,
  text,
}: {
  children: React.ReactNode;
  text: string;
}) => {
  const [show, setShow] = useState(false);
  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs font-medium text-white shadow-lg"
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const IconBtn = ({
  children,
  tip,
  onClick,
  className,
  disabled,
  active,
}: {
  children: React.ReactNode;
  tip: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  active?: boolean;
}) => (
  <Tooltip text={tip}>
    <button
      type="button"
      aria-label={tip}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:scale-105 hover:bg-accent/10 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-40",
        active && "bg-accent/10 text-foreground",
        className
      )}
    >
      {children}
    </button>
  </Tooltip>
);

const Toggle = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) => (
  <div className="flex items-center rounded-md border border-border/60 bg-black/20 p-0.5">
    {options.map((o) => (
      <button
        key={o.value}
        onClick={() => onChange(o.value)}
        className={cn(
          "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-all",
          value === o.value
            ? "bg-white/10 text-white"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {o.icon}
        {o.label}
      </button>
    ))}
  </div>
);

/* ──────────────────────────────────────────────────────────────
   Sidebar
   ────────────────────────────────────────────────────────────── */
interface SidebarProps {
  projects: Conversation[];
  activeProjectId: string | null;
  setActiveProject: (id: string) => void;
  userProfile: UserProfile | null;
  onLogout: () => void;
  onNewProject: () => void;
  collapsed: boolean;
  toggleSidebar: () => void;
  onDeleteProject: (id: string) => void;
}

const Sidebar = ({
  projects,
  activeProjectId,
  setActiveProject,
  userProfile,
  onLogout,
  onNewProject,
  collapsed,
  toggleSidebar,
  onDeleteProject,
}: SidebarProps) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const visible = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return q
      ? projects.filter((c) => c.title?.toLowerCase().includes(q))
      : projects;
  }, [projects, debouncedQuery]);

  const Logo = () => (
    <div className="relative h-7 w-7 overflow-hidden rounded-full">
      <Image
        src="/logo.png"
        alt="Vatsa AI"
        width={28}
        height={28}
        className="rounded-full object-cover"
        priority
      />
    </div>
  );

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 60 : 256 }}
      transition={{ type: "spring", stiffness: 420, damping: 40 }}
      className="relative hidden h-full shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar md:flex"
    >
      <div className="flex h-full min-w-0 flex-col">
        <div
          className={cn(
            "flex items-center gap-2 px-3 pt-4",
            collapsed && "justify-center"
          )}
        >
          {!collapsed ? (
            <>
              <Logo />
              <span className="truncate text-[16px] font-semibold tracking-tight text-foreground">
                Vatsa AI
              </span>
            </>
          ) : (
            <Logo />
          )}
          <IconBtn
            tip={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleSidebar}
            className="ml-auto"
          >
            <PanelLeft className="h-[18px] w-[18px]" />
          </IconBtn>
        </div>

        {!collapsed && (
          <>
            <div className="px-3 pt-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onNewProject}
                className="flex w-full items-center gap-2 rounded-xl border border-border bg-accent/5 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/10"
              >
                <Plus className="h-4 w-4" /> New Project
              </motion.button>
            </div>

            <div className="px-3 pt-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full rounded-xl border border-border bg-input/10 py-2 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 flex-1 overflow-y-auto px-2">
              {visible.length > 0 ? (
                visible.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setActiveProject(c.id)}
                    className={cn(
                      "group relative flex cursor-pointer items-center rounded-lg px-2.5 py-[6px] text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground",
                      activeProjectId === c.id &&
                        "bg-accent/10 text-foreground"
                    )}
                  >
                    <Folder className="mr-2 h-3.5 w-3.5 shrink-0 opacity-40" />
                    <span className="truncate">
                      {c.title || "Project"}
                    </span>
                    {activeProjectId === c.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Delete this project?"))
                            onDeleteProject(c.id);
                        }}
                        aria-label="Delete project"
                        className="ml-auto rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                  <Folder className="mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-foreground/70">
                    No projects
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    Create your first project
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        <div className="border-t border-border px-2 py-2">
          {!collapsed ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-sm font-medium text-accent-foreground">
                  {userProfile?.full_name?.[0] || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight text-foreground">
                    {userProfile?.full_name || "User"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {userProfile?.email || "user@email.com"}
                  </p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-400/10"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <IconBtn tip="Settings" onClick={() => {}}>
                <Settings className="h-4 w-4" />
              </IconBtn>
              <IconBtn tip="Sign Out" onClick={onLogout}>
                <LogOut className="h-4 w-4" />
              </IconBtn>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
};

/* ──────────────────────────────────────────────────────────────
   Message actions (copy / regenerate / edit)
   ────────────────────────────────────────────────────────────── */
const MessageActions = ({
  content,
  onCopy,
  onRegenerate,
  onEdit,
  showEdit,
}: {
  content: string;
  onCopy: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  showEdit?: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        onClick={() => {
          navigator.clipboard.writeText(content);
          setCopied(true);
          onCopy();
          setTimeout(() => setCopied(false), 1400);
        }}
        aria-label="Copy message"
        className="rounded p-1 text-muted-foreground/60 hover:bg-accent/10 hover:text-foreground"
      >
        {copied ? (
          <Check className="h-3 w-3" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          aria-label="Regenerate"
          className="rounded p-1 text-muted-foreground/60 hover:bg-accent/10 hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
      {showEdit && onEdit && (
        <button
          onClick={onEdit}
          aria-label="Edit"
          className="rounded p-1 text-muted-foreground/60 hover:bg-accent/10 hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   File Explorer (tree-ish list)
   ────────────────────────────────────────────────────────────── */
const FileExplorer = ({
  files,
  activeFile,
  onSelect,
}: {
  files: ProjectFile[];
  activeFile: string;
  onSelect: (name: string) => void;
}) => (
  <div className="h-full w-48 overflow-y-auto border-r border-border/40 bg-muted/10 p-2">
    <div className="mb-2 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
      <FolderOpen className="h-3 w-3" /> Files
      <span className="ml-auto rounded bg-accent/10 px-1.5 py-0.5 text-[9px] text-accent">
        {files.length}
      </span>
    </div>
    {files.map((f) => (
      <button
        key={f.name}
        onClick={() => onSelect(f.name)}
        className={cn(
          "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-all",
          activeFile === f.name
            ? "bg-accent/20 text-foreground"
            : "text-muted-foreground/60 hover:bg-accent/10 hover:text-foreground"
        )}
      >
        <FileIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span className="truncate">{f.name}</span>
      </button>
    ))}
  </div>
);

/* ──────────────────────────────────────────────────────────────
   Code Preview Panel
   ────────────────────────────────────────────────────────────── */
interface CodePreviewPanelProps {
  codeContent: string;
  setCodeContent: (content: string) => void;
  previewMode: PreviewMode;
  setPreviewMode: (mode: PreviewMode) => void;
  theme: ThemeMode;
  files: ProjectFile[];
  setFiles: (files: ProjectFile[]) => void;
  activeFile: string;
  setActiveFile: (file: string) => void;
  notify: (msg: string, kind?: Toast["kind"]) => void;
}

const CodePreviewPanel = ({
  codeContent,
  setCodeContent,
  previewMode,
  setPreviewMode,
  theme,
  files,
  setFiles,
  activeFile,
  setActiveFile,
  notify,
}: CodePreviewPanelProps) => {
  const [key, setKey] = useState(0);
  const [device, setDevice] = useState<Device>("desktop");

  const handleDownloadZip = useCallback(async () => {
    try {
      const zip = new JSZip();
      files.forEach((f) => zip.file(f.name, f.content));
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, "vatsa-project.zip");
      notify("ZIP downloaded", "success");
    } catch {
      files.forEach((f) => {
        const blob = new Blob([f.content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = f.name;
        a.click();
        URL.revokeObjectURL(url);
      });
      notify("Downloaded files individually", "info");
    }
  }, [files, notify]);

  const handleOpen = useCallback(() => {
    if (!codeContent) return;
    const blob = new Blob([codeContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, [codeContent]);

  const handleCopyAll = useCallback(() => {
    const current = files.find((f) => f.name === activeFile);
    if (current) {
      navigator.clipboard.writeText(current.content);
      notify("File copied", "success");
    }
  }, [files, activeFile, notify]);

  const deviceWidth =
    device === "desktop"
      ? "100%"
      : device === "tablet"
      ? "768px"
      : "375px";

  const hasCode = files.some((f) => f.content.trim().length > 0);
  const displayContent =
    codeContent ||
    "<!doctype html><html><body style='font-family:system-ui;padding:24px;color:#888;background:#0a0a0a;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;'>Waiting for AI to generate code…</body></html>";

  return (
    <div className="flex h-full flex-col bg-background/40 backdrop-blur-sm">
      <div className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-border/40 px-3">
        <span className="mr-2 text-xs font-medium text-muted-foreground/60">
          {previewMode === "preview" ? "Preview" : "Code"}
        </span>
        <button
          onClick={() => setPreviewMode("preview")}
          aria-label="Preview"
          className={cn(
            "rounded px-2 py-1 text-xs transition-all",
            previewMode === "preview"
              ? "bg-accent/20 text-foreground"
              : "text-muted-foreground/40 hover:bg-accent/10 hover:text-foreground"
          )}
        >
          <Monitor className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setPreviewMode("code")}
          aria-label="Code"
          className={cn(
            "rounded px-2 py-1 text-xs transition-all",
            previewMode === "code"
              ? "bg-accent/20 text-foreground"
              : "text-muted-foreground/40 hover:bg-accent/10 hover:text-foreground"
          )}
        >
          <Code className="h-3.5 w-3.5" />
        </button>

        <div className="mx-1 h-5 w-px bg-border/40" />
        <IconBtn
          tip="Desktop"
          onClick={() => setDevice("desktop")}
          active={device === "desktop"}
        >
          <Monitor className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn
          tip="Tablet"
          onClick={() => setDevice("tablet")}
          active={device === "tablet"}
        >
          <Tablet className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn
          tip="Mobile"
          onClick={() => setDevice("mobile")}
          active={device === "mobile"}
        >
          <Smartphone className="h-3.5 w-3.5" />
        </IconBtn>

        <div className="mx-1 h-5 w-px bg-border/40" />
        <IconBtn tip="Refresh" onClick={() => setKey((k) => k + 1)}>
          <RefreshCw className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn tip="Open in new tab" onClick={handleOpen} disabled={!hasCode}>
          <ExternalLink className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn
          tip="Copy active file"
          onClick={handleCopyAll}
          disabled={!hasCode}
        >
          <Copy className="h-3.5 w-3.5" />
        </IconBtn>

        <IconBtn
          tip="Download ZIP"
          onClick={handleDownloadZip}
          disabled={!hasCode}
          className="ml-auto"
        >
          <Download className="h-3.5 w-3.5" />
        </IconBtn>
      </div>

      <div className="flex-1 overflow-auto bg-background/20 p-2">
        {previewMode === "preview" ? (
          <div className="flex h-full w-full items-center justify-center">
            <div
              className="h-full w-full overflow-hidden rounded-xl border border-border/40 bg-card/80 shadow-2xl"
              style={{ maxWidth: deviceWidth, margin: "0 auto" }}
            >
              <div className="flex h-7 items-center gap-2 border-b border-border/40 bg-muted/20 px-3">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <span className="ml-2 text-[10px] text-muted-foreground/40">
                  preview.local
                </span>
              </div>
              <div className="h-[calc(100%-28px)] overflow-auto bg-white">
                <iframe
                  key={key}
                  srcDoc={displayContent}
                  sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups"
                  className="h-full w-full border-0"
                  title="Live Preview"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full gap-2">
            <FileExplorer
              files={files}
              activeFile={activeFile}
              onSelect={setActiveFile}
            />
            <div className="h-full flex-1 overflow-hidden rounded-lg border border-border/40 bg-black/40">
              <MonacoEditor
                value={
                  files.find((f) => f.name === activeFile)?.content || ""
                }
                onChange={(value) => {
                  const newFiles = files.map((f) =>
                    f.name === activeFile
                      ? { ...f, content: value || "" }
                      : f
                  );
                  setFiles(newFiles);
                  if (activeFile === "index.html") {
                    setCodeContent(value || "");
                  }
                }}
                language={
                  files.find((f) => f.name === activeFile)?.language ||
                  languageFromName(activeFile)
                }
                theme={theme === "dark" ? "vs-dark" : "light"}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  automaticLayout: true,
                  wordWrap: "on",
                  lineNumbers: "on",
                  folding: true,
                  renderWhitespace: "selection",
                  tabSize: 2,
                }}
                className="h-full w-full"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   Command palette
   ────────────────────────────────────────────────────────────── */
const CommandPalette = ({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: { id: string; label: string; hint?: string; run: () => void }[];
}) => {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  const run = (i: number) => {
    const cmd = filtered[i];
    if (!cmd) return;
    cmd.run();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: -8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: -8 }}
            className="w-full max-w-lg overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setCursor((c) =>
                      Math.min(c + 1, filtered.length - 1)
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setCursor((c) => Math.max(c - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    run(cursor);
                  }
                }}
                placeholder="Type a command..."
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                ESC
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No matches.
                </div>
              ) : (
                filtered.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => run(i)}
                    onMouseEnter={() => setCursor(i)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                      i === cursor
                        ? "bg-accent/15 text-foreground"
                        : "text-muted-foreground hover:bg-accent/10"
                    )}
                  >
                    <span className="flex-1">{c.label}</span>
                    {c.hint && (
                      <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {c.hint}
                      </kbd>
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ──────────────────────────────────────────────────────────────
   Quick suggestions
   ────────────────────────────────────────────────────────────── */
const QUICK_SUGGESTIONS = [
  { label: "Build a website", icon: <Globe className="h-4 w-4" /> },
  { label: "Create a React component", icon: <Code className="h-4 w-4" /> },
  { label: "Write an API server", icon: <Folder className="h-4 w-4" /> },
  { label: "Fix a bug", icon: <Bug className="h-4 w-4" /> },
  { label: "Explain code", icon: <BookOpen className="h-4 w-4" /> },
  { label: "Design a dashboard", icon: <Monitor className="h-4 w-4" /> },
];

function buildSuggestions(): string[] {
  const actions = ["Build","Create","Design","Develop","Write","Implement","Deploy","Optimize","Refactor","Test","Launch","Scale"];
  const topics = ["website","web app","mobile app","API","dashboard","component","tool","system","platform","SaaS"];
  const techs = ["React","Next.js","TypeScript","Node.js","Python","FastAPI","PostgreSQL","Redis","Docker","Tailwind","GraphQL","Prisma","Supabase"];
  const specifics = ["authentication","payment integration","real-time chat","data visualization","analytics","AI integration","search","recommendation engine","serverless"];

  const hand = [
    "Build a full-stack Next.js app with authentication",
    "Create a real-time chat app with Socket.io",
    "Design a modern dashboard with shadcn/ui",
    "Develop a REST API with FastAPI and PostgreSQL",
    "Build a SaaS platform with Stripe payments",
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
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ──────────────────────────────────────────────────────────────
   Main
   ────────────────────────────────────────────────────────────── */
export default function CodeWorkspacePage() {
  const router = useRouter();
  const pathname = usePathname();

  /* Toast */
  const { toasts, push: notify, dismiss: dismissToast } = useToasts();

  /* Core state */
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);

  /* UI state */
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [accentColor, setAccentColor] = useState<AccentColor>("default");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [model, setModel] = useState<string>("auto");

  /* Auth */
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  /* Chat */
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  /* Workspace */
  const [codeContent, setCodeContent] = useState("");
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("preview");
  const [files, setFiles] = useState<ProjectFile[]>([
    { name: "index.html", content: "" },
  ]);
  const [activeFile, setActiveFile] = useState("index.html");
  const [builderWidth, setBuilderWidth] = useState(40);

  /* Refs */
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const activeProjectIdRef = useRef<string | null>(null);

  /* Auto-resize input */
  useAutoResize(inputRef, inputValue, 200);

  /* Keep refs in sync */
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  /* Track unmount */
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  /* Load/save conversations from localStorage */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setConversations(parsed);
      }
    } catch (e) {
      console.warn("Could not load saved conversations", e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (e) {
      console.warn("Could not persist conversations", e);
    }
  }, [conversations]);

  /* Derived */
  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeProjectId) || null,
    [conversations, activeProjectId]
  );
  const currentMessages = activeConv?.messages || [];

  /* Suggestions carousel — slower, and pauses on hover/typing */
  const allSuggestions = useMemo(buildSuggestions, []);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);

  useEffect(() => {
    if (carouselPaused || inputValue) return;
    const t = setInterval(
      () => setSuggestionIndex((i) => (i + 1) % allSuggestions.length),
      4000
    );
    return () => clearInterval(t);
  }, [allSuggestions.length, carouselPaused, inputValue]);

  const currentSuggestion = allSuggestions[suggestionIndex] || "";

  /* Theme */
  const handleThemeChange = useCallback((next: ThemeMode) => {
    setTheme(next);
    localStorage.setItem("vatsa-theme", next);
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = next === "dark" || (next === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("vatsa-theme") as ThemeMode | null;
    const savedAccent = localStorage.getItem(
      "vatsa-accent"
    ) as AccentColor | null;
    if (savedTheme) handleThemeChange(savedTheme);
    if (savedAccent) setAccentColor(savedAccent);
  }, [handleThemeChange]);

  useEffect(() => {
    localStorage.setItem("vatsa-accent", accentColor);
  }, [accentColor]);

  /* Fetch server conversations & merge */
  const fetchConversations = useCallback(async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        router.push("/auth/login");
        return;
      }
      const res = await fetch(
        `${API_BASE}/api/conversations?workspace=code`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      if (!res.ok) {
        console.warn(`Conversations fetch failed: ${res.statusText}`);
        return;
      }
      const data = await res.json();
      const serverList: Conversation[] = Array.isArray(data) ? data : [];

      setConversations((prev) => {
        const map = new Map<string, Conversation>();
        for (const c of serverList) map.set(c.id, c);
        for (const c of prev) {
          const existing = map.get(c.id);
          if (!existing) map.set(c.id, c);
          else if (
            (c.messages?.length || 0) > (existing.messages?.length || 0)
          ) {
            map.set(c.id, { ...existing, messages: c.messages });
          }
        }
        return Array.from(map.values()).sort((a, b) => {
          const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return tb - ta;
        });
      });
    } catch (err) {
      console.warn("fetchConversations error:", err);
    } finally {
      if (mountedRef.current) setIsLoadingConversations(false);
    }
  }, [router]);

  /* Auth bootstrap */
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      router.push("/auth/login");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setUserProfile(data);
        }
      } catch (err) {
        console.error("Auth error:", err);
      } finally {
        if (!cancelled) {
          setIsAuthLoading(false);
          await fetchConversations();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, fetchConversations]);

  /* Auto-scroll on new messages */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages.length, activeProjectId]);

  /* Update conversation helper */
  const updateConversationMessages = useCallback(
    (convId: string, newMessages: Message[]) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: newMessages,
                updatedAt: new Date().toISOString(),
              }
            : c
        )
      );
    },
    []
  );

  /* Create project (server → local fallback) */
  const createProject = useCallback(
    async (title: string): Promise<string> => {
      const localId = uid("local");
      const base: Conversation = {
        id: localId,
        title,
        workspace: "code",
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        const res = await fetch(`${API_BASE}/api/conversations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ title, workspace: "code" }),
        });
        if (res.ok) {
          const data = await res.json();
          const id = data.id || localId;
          const conv: Conversation = { ...base, id, title: data.title || title };
          setConversations((prev) =>
            prev.some((c) => c.id === id) ? prev : [conv, ...prev]
          );
          return id;
        }
      } catch (err) {
        console.warn("createProject network error:", err);
      }
      setConversations((prev) => [base, ...prev]);
      return localId;
    },
    []
  );

  /* Delete project */
  const handleDeleteProject = useCallback(async (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeProjectIdRef.current === id) {
      setActiveProjectId(null);
      setShowCodePanel(false);
      setCodeContent("");
      setFiles([{ name: "index.html", content: "" }]);
      setActiveFile("index.html");
    }
    if (id.startsWith("local-")) return;
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;
      await fetch(`${API_BASE}/api/conversations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* fire & forget */
    }
  }, []);

  /* Switch project */
  const handleUserSwitchProject = useCallback(
    (id: string) => {
      if (id === activeProjectIdRef.current) return;
      abortRef.current?.abort();
      setIsLoading(false);
      setShowCodePanel(false);
      setCodeContent("");
      setFiles([{ name: "index.html", content: "" }]);
      setActiveFile("index.html");
      setInputValue("");
      setActiveProjectId(id);
      activeProjectIdRef.current = id;
    },
    []
  );

  /* Send message (SSE streaming when supported) */
  const sendMessage = useCallback(
    async (content: string, opts?: { regenerateFrom?: number }) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      if (isLoading) {
        abortRef.current?.abort();
        setIsLoading(false);
        return;
      }

      let convId = activeProjectIdRef.current;
      if (!convId) {
        const title = trimmed.slice(0, 40) + (trimmed.length > 40 ? "…" : "");
        convId = await createProject(title || "New Project");
        setActiveProjectId(convId);
        activeProjectIdRef.current = convId;
      }

      const conversation = conversationsRef.current.find(
        (c) => c.id === convId
      );
      let baseMessages = conversation?.messages || [];

      // Regenerate: trim off trailing assistant messages
      if (opts?.regenerateFrom != null) {
        baseMessages = baseMessages.slice(0, opts.regenerateFrom);
      }

      const userMsg: Message = {
        id: uid("user"),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      const withUser = [...baseMessages, userMsg];
      updateConversationMessages(convId, withUser);

      setInputValue("");
      setPromptHistory((h) => [trimmed, ...h].slice(0, 50));
      setHistoryCursor(-1);
      setShowCodePanel(true);
      setIsLoading(true);

      // Title from first message
      if (baseMessages.length === 0) {
        const newTitle =
          trimmed.slice(0, 40) + (trimmed.length > 40 ? "…" : "");
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId ? { ...c, title: newTitle } : c
          )
        );
      }

      const token = localStorage.getItem(TOKEN_KEY);
      const userId = userProfile?.email || "";

      try {
        abortRef.current = new AbortController();
        const response = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream, application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            message: trimmed,
            user_id: userId,
            model,
            conversation_id: convId,
            workspace: "code",
            stream: true,
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          let msg = "Failed to get response from AI";
          try {
            const err = await response.json();
            msg = err.message || err.detail || msg;
          } catch {}
          throw new Error(msg);
        }

        const contentType = response.headers.get("content-type") || "";
        let text = "";
        let parsedFiles: ProjectFile[] = [];

        if (
          contentType.includes("text/event-stream") &&
          response.body
        ) {
          /* ── Streaming path ── */
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let streamedText = "";

          // Insert a placeholder assistant message
          const assistantId = uid("assistant");
          const placeholder: Message = {
            id: assistantId,
            role: "assistant",
            content: "",
            createdAt: new Date().toISOString(),
            model: "Vatsa AI",
          };
          updateConversationMessages(convId, [...withUser, placeholder]);

          const flush = () => {
            // Update the placeholder in place
            setConversations((prev) =>
              prev.map((c) =>
                c.id === convId
                  ? {
                      ...c,
                      messages: c.messages.map((m) =>
                        m.id === assistantId
                          ? { ...m, content: streamedText }
                          : m
                      ),
                      updatedAt: new Date().toISOString(),
                    }
                  : c
              )
            );
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const raw of lines) {
              const line = raw.trim();
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const evt = JSON.parse(payload);
                if (typeof evt === "string") streamedText += evt;
                else if (evt.delta) streamedText += evt.delta;
                else if (evt.token) streamedText += evt.token;
                else if (evt.content) streamedText += evt.content;
                else if (evt.response) streamedText += evt.response;
                flush();
              } catch {
                streamedText += payload;
                flush();
              }
            }
          }

          text = streamedText;
          const finalNorm = normalizeResponse({ response: text });
          parsedFiles = finalNorm.files;
        } else {
          /* ── Non-streaming path ── */
          const data = await response.json();
          const normalized = normalizeResponse(data);
          text = normalized.text;
          parsedFiles = normalized.files;

          const assistantMsg: Message = {
            id: uid("assistant"),
            role: "assistant",
            content: text || "Done.",
            createdAt: new Date().toISOString(),
            model: "Vatsa AI",
          };
          updateConversationMessages(convId, [...withUser, assistantMsg]);
        }

        if (parsedFiles.length > 0) {
          setFiles(parsedFiles);
          const main =
            parsedFiles.find((f) => /index\.html?$/i.test(f.name)) ||
            parsedFiles.find((f) => /\.html?$/i.test(f.name)) ||
            parsedFiles[0];
          setCodeContent(main.content);
          setActiveFile(main.name);
          setShowCodePanel(true);
          setPreviewMode("preview");
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          updateConversationMessages(convId, [
            ...withUser,
            {
              id: uid("stopped"),
              role: "assistant",
              content: "⏹️ Generation stopped.",
              createdAt: new Date().toISOString(),
            },
          ]);
        } else {
          console.error("Chat error:", err);
          notify(err.message || "Failed to get response.", "error");
          updateConversationMessages(convId, [
            ...withUser,
            {
              id: uid("error"),
              role: "assistant",
              content:
                "⚠️ " + (err.message || "An error occurred. Please try again."),
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      } finally {
        if (mountedRef.current) setIsLoading(false);
        abortRef.current = null;
      }
    },
    [isLoading, userProfile, model, updateConversationMessages, createProject, notify]
  );

  const handleNewProject = useCallback(async () => {
    abortRef.current?.abort();
    setIsLoading(false);
    const id = await createProject("New Project");
    setActiveProjectId(id);
    activeProjectIdRef.current = id;
    setShowCodePanel(false);
    setCodeContent("");
    setFiles([{ name: "index.html", content: "" }]);
    setActiveFile("index.html");
    setInputValue("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [createProject]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    router.push("/auth/login");
  }, [router]);

  const toggleSidebar = useCallback(
    () => setSidebarCollapsed((p) => !p),
    []
  );

  /* Regenerate last assistant response */
  const regenerateLast = useCallback(() => {
    const msgs = conversationsRef.current.find(
      (c) => c.id === activeProjectIdRef.current
    )?.messages;
    if (!msgs) return;
    // Find last user message index
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "user") {
        sendMessage(msgs[i].content, { regenerateFrom: i });
        return;
      }
    }
  }, [sendMessage]);

  /* Edit user message */
  const editUserMessage = useCallback((msg: Message) => {
    setInputValue(msg.content);
    inputRef.current?.focus();
  }, []);

  /* Keyboard shortcuts */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Command palette
      if (ctrl && !shift && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
        return;
      }
      if (e.key === "Escape") {
        setCommandOpen(false);
      }
      // New project
      if (ctrl && shift && e.key.toLowerCase() === "o") {
        e.preventDefault();
        handleNewProject();
      }
      // Toggle sidebar
      if (ctrl && !shift && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
      // Regenerate
      if (ctrl && shift && e.key.toLowerCase() === "r") {
        e.preventDefault();
        regenerateLast();
      }
      // Focus input
      if (ctrl && !shift && e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNewProject, toggleSidebar, regenerateLast]);

  /* Content click focuses input — but not if user is selecting text */
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("textarea") ||
      target.closest("input") ||
      target.closest("iframe") ||
      target.closest("[data-no-focus]")
    )
      return;
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    inputRef.current?.focus();
  }, []);

  /* Accent color */
  const accentColorHex = useMemo(() => {
    switch (accentColor) {
      case "blue": return "#3b82f6";
      case "purple": return "#a855f7";
      case "green": return "#10b981";
      case "orange": return "#f97316";
      default: return "#a855f7";
    }
  }, [accentColor]);

  /* Splitter drag */
  const onSplitterDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const container = (e.currentTarget as HTMLElement).parentElement;
      if (!container) return;
      const totalWidth = container.clientWidth;
      const startWidth = builderWidth;

      const onMove = (ev: MouseEvent) => {
        const delta = ((ev.clientX - startX) / totalWidth) * 100;
        const next = Math.min(70, Math.max(20, startWidth + delta));
        setBuilderWidth(next);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [builderWidth]
  );

  /* Prompt history navigation */
  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (inputValue.trim()) sendMessage(inputValue);
        return;
      }
      if (e.key === "ArrowUp" && !inputValue && promptHistory.length) {
        e.preventDefault();
        const next = Math.min(historyCursor + 1, promptHistory.length - 1);
        setHistoryCursor(next);
        setInputValue(promptHistory[next]);
      }
      if (e.key === "ArrowDown" && historyCursor >= 0) {
        e.preventDefault();
        const next = historyCursor - 1;
        setHistoryCursor(next);
        setInputValue(next >= 0 ? promptHistory[next] : "");
      }
    },
    [inputValue, sendMessage, promptHistory, historyCursor]
  );

  /* Command palette commands */
  const paletteCommands = useMemo(
    () => [
      {
        id: "new",
        label: "New Project",
        hint: `${MOD_KEY}+Shift+O`,
        run: handleNewProject,
      },
      {
        id: "sidebar",
        label: "Toggle Sidebar",
        hint: `${MOD_KEY}+B`,
        run: toggleSidebar,
      },
      {
        id: "regen",
        label: "Regenerate Last Response",
        hint: `${MOD_KEY}+Shift+R`,
        run: regenerateLast,
      },
      {
        id: "theme-dark",
        label: "Theme: Dark",
        run: () => handleThemeChange("dark"),
      },
      {
        id: "theme-light",
        label: "Theme: Light",
        run: () => handleThemeChange("light"),
      },
      {
        id: "theme-system",
        label: "Theme: System",
        run: () => handleThemeChange("system"),
      },
      {
        id: "accent-purple",
        label: "Accent: Purple",
        run: () => setAccentColor("purple"),
      },
      {
        id: "accent-blue",
        label: "Accent: Blue",
        run: () => setAccentColor("blue"),
      },
      {
        id: "accent-green",
        label: "Accent: Green",
        run: () => setAccentColor("green"),
      },
      {
        id: "logout",
        label: "Sign Out",
        run: handleLogout,
      },
    ],
    [
      handleNewProject,
      toggleSidebar,
      regenerateLast,
      handleThemeChange,
      handleLogout,
    ]
  );

  /* Loading / error gates */
  if (isAuthLoading || isLoadingConversations) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-accent" />
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h2 className="mb-2 text-xl font-semibold">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground">{fatalError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-accent-foreground hover:bg-accent/80"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const showEmptyState = !showCodePanel && currentMessages.length === 0;
  const greeting = getGreeting();

  return (
    <>
      <Background />
      <main
        suppressHydrationWarning
        className={cn(
          "relative z-10 min-h-screen overflow-hidden transition-colors duration-300",
          theme === "dark" ? "dark" : ""
        )}
        style={{ "--accent": accentColorHex } as React.CSSProperties}
      >
        <div className="relative z-10 flex h-screen flex-col">
          {/* Header */}
          <header className="flex h-10 shrink-0 items-center justify-between border-b border-border/40 bg-background/40 px-4 backdrop-blur-sm">
            <div className="w-8" />
            <div className="flex items-center gap-2">
              <Toggle
                options={[
                  { value: "/", label: "Chat" },
                  { value: "/code", label: "Code" },
                ]}
                value={pathname === "/code" ? "/code" : "/"}
                onChange={(v) => router.push(v)}
              />
            </div>
            <div className="flex items-center gap-1">
              <IconBtn
                tip={`Command palette (${MOD_KEY}+K)`}
                onClick={() => setCommandOpen(true)}
              >
                <CommandIcon className="h-4 w-4" />
              </IconBtn>
              <IconBtn
                tip="Toggle theme"
                onClick={() =>
                  handleThemeChange(theme === "dark" ? "light" : "dark")
                }
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </IconBtn>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            <Sidebar
              projects={conversations}
              activeProjectId={activeProjectId}
              setActiveProject={handleUserSwitchProject}
              userProfile={userProfile}
              onLogout={handleLogout}
              onNewProject={handleNewProject}
              collapsed={sidebarCollapsed}
              toggleSidebar={toggleSidebar}
              onDeleteProject={handleDeleteProject}
            />

            <div
              ref={mainContentRef}
              className="flex-1 cursor-text overflow-y-auto bg-background/40 backdrop-blur-sm"
              onClick={handleContentClick}
            >
              {showEmptyState ? (
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
                      transition={{
                        duration: 0.8,
                        delay: 0.1,
                        type: "spring",
                      }}
                      className="relative mx-auto h-48 w-48 md:h-56 md:w-56"
                    >
                      <div className="absolute inset-0 animate-pulse rounded-full bg-accent/20 blur-3xl" />
                      <div className="relative h-full w-full overflow-hidden rounded-full bg-gradient-to-br from-accent/10 via-transparent to-accent/5 p-2">
                        <Image
                          src="/vatsaAi.png"
                          alt="Vatsa AI"
                          width={224}
                          height={224}
                          className="rounded-full object-cover"
                          priority
                        />
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                      className="space-y-2"
                    >
                      <p className="text-sm text-muted-foreground/60">
                        {greeting}
                      </p>
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
                          <IconBtn
                            tip="Attach file"
                            onClick={() => {
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = ".html,.css,.js,.ts,.tsx,.jsx,.json,.md,.py,.txt";
                              input.onchange = (e) => {
                                const file = (
                                  e.target as HTMLInputElement
                                ).files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const content = ev.target?.result;
                                  if (typeof content === "string") {
                                    setFiles([
                                      { name: file.name, content },
                                    ]);
                                    setActiveFile(file.name);
                                    if (/\.html?$/i.test(file.name))
                                      setCodeContent(content);
                                    setShowCodePanel(true);
                                    setPreviewMode("preview");
                                    notify(`Attached ${file.name}`, "success");
                                  }
                                };
                                reader.readAsText(file);
                              };
                              input.click();
                            }}
                          >
                            <PlusCircle className="h-4 w-4" />
                          </IconBtn>
                          <IconBtn
                            tip="Voice input"
                            onClick={() => {
                              const W = window as any;
                              const SR =
                                W.SpeechRecognition ||
                                W.webkitSpeechRecognition;
                              if (!SR) {
                                notify(
                                  "Voice input not supported in this browser.",
                                  "error"
                                );
                                return;
                              }
                              const rec = new SR();
                              rec.lang = "en-US";
                              rec.onresult = (event: any) => {
                                const transcript =
                                  event.results[0][0].transcript;
                                setInputValue(transcript);
                                inputRef.current?.focus();
                              };
                              rec.start();
                            }}
                          >
                            <Mic className="h-4 w-4" />
                          </IconBtn>
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
              ) : (
                <div className="flex h-full">
                  {/* Chat column */}
                  <div
                    className="flex h-full flex-col border-r border-border/40 bg-background/20"
                    style={{ width: `${builderWidth}%` }}
                  >
                    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                      {currentMessages.map((msg, i) => {
                        const isUser = msg.role === "user";
                        const isLastAssistant =
                          !isUser &&
                          i === currentMessages.length - 1;
                        return (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              "group flex",
                              isUser ? "justify-end" : "justify-start"
                            )}
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
                                  <ReactMarkdown>
                                    {msg.content}
                                  </ReactMarkdown>
                                </div>
                              )}
                              <MessageActions
                                content={msg.content}
                                onCopy={() =>
                                  notify("Copied", "success")
                                }
                                showEdit={isUser}
                                onEdit={() => editUserMessage(msg)}
                                onRegenerate={
                                  isLastAssistant
                                    ? regenerateLast
                                    : undefined
                                }
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
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        {isLoading ? (
                          <button
                            onClick={() => {
                              abortRef.current?.abort();
                              setIsLoading(false);
                            }}
                            aria-label="Stop"
                            className="rounded-full bg-red-500/80 p-1.5 text-white hover:scale-105"
                          >
                            <StopCircle className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (inputValue.trim())
                                sendMessage(inputValue);
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

                  {/* Splitter */}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    onMouseDown={onSplitterDown}
                    className="w-1 cursor-col-resize bg-border/40 transition-colors hover:bg-accent/30"
                  />

                  {/* Preview */}
                  <div className="h-full flex-1">
                    <CodePreviewPanel
                      codeContent={codeContent}
                      setCodeContent={setCodeContent}
                      previewMode={previewMode}
                      setPreviewMode={setPreviewMode}
                      theme={theme}
                      files={files}
                      setFiles={setFiles}
                      activeFile={activeFile}
                      setActiveFile={setActiveFile}
                      notify={notify}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Toasts */}
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 left-1/2 z-[150] flex -translate-x-1/2 flex-col gap-2"
        >
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.96 }}
                className={cn(
                  "pointer-events-auto flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg backdrop-blur-sm",
                  t.kind === "success" &&
                    "border-green-500/30 bg-green-500/10 text-green-300",
                  t.kind === "error" &&
                    "border-destructive/30 bg-destructive/10 text-destructive-foreground",
                  t.kind === "info" &&
                    "border-border/60 bg-card/90 text-foreground"
                )}
                onClick={() => dismissToast(t.id)}
              >
                {t.kind === "error" && (
                  <AlertCircle className="h-4 w-4" />
                )}
                {t.kind === "success" && <Check className="h-4 w-4" />}
                <span>{t.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Command palette */}
        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          commands={paletteCommands}
        />
      </main>
    </>
  );
}