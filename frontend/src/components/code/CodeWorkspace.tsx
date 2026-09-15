"use client";

import React, {
  useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect,
} from "react";
import { useRouter, usePathname } from "next/navigation";
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
import { MonacoEditor } from "@/components/code/MonacoEditor";
import { Sidebar } from "@/components/code/Sidebar";
import { CodePreviewPanel } from "@/components/code/CodePreviewPanel";
import { CommandPalette } from "@/components/code/CommandPalette";
import { MessageActions } from "@/components/code/MessageActions";
import { useAuthStore, useUser, useAccessToken } from "@/stores/auth";
import { chat, Conversation, ChatMessage } from "@/services/chat";
import { useToasts } from "@/hooks/useToasts";

/* ──────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────── */
export interface ProjectFile {
  name: string;
  content: string;
  language?: string;
}

type ThemeMode = "dark" | "light" | "system";
type AccentColor = "default" | "blue" | "purple" | "green" | "orange";
type PreviewMode = "preview" | "code";
type Device = "desktop" | "tablet" | "mobile";

const isMac =
  typeof navigator !== "undefined" &&
  navigator.platform.toUpperCase().indexOf("MAC") >= 0;
const MOD_KEY = isMac ? "⌘" : "Ctrl";
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const MODELS = [
  { id: "auto", label: "Auto (recommended)" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
] as const;

/* ──────────────────────────────────────────────────────────────
   Utilities
   ────────────────────────────────────────────────────────────── */
function uid(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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
      text: data?.response || data?.message || `Generated ${files.length} file(s).`,
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
   Main Component
   ────────────────────────────────────────────────────────────── */
export function CodeWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useUser();
  const accessToken = useAccessToken();
  const logout = useAuthStore((s) => s.logout);

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

  /* Fetch conversations from backend */
  const fetchConversations = useCallback(async () => {
    try {
      if (!accessToken) {
        router.push("/auth/login");
        return;
      }
      const res = await fetch(
        `${API_BASE}/api/conversations?workspace=code`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
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
  }, [accessToken, router]);

  /* Load conversations on auth */
  useEffect(() => {
    if (accessToken) {
      fetchConversations();
    }
  }, [accessToken, fetchConversations]);

  /* Auto-scroll on new messages */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeProjectId]);

  /* Derived */
  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeProjectId) || null,
    [conversations, activeProjectId]
  );
  const currentMessages = activeConv?.messages || [];

  /* Suggestions carousel */
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
  }, []);
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
    const savedAccent = localStorage.getItem("vatsa-accent") as AccentColor | null;
    if (savedTheme) handleThemeChange(savedTheme);
    if (savedAccent) setAccentColor(savedAccent);
  }, [handleThemeChange]);

  useEffect(() => {
    localStorage.setItem("vatsa-accent", accentColor);
  }, [accentColor]);

  /* Update conversation helper */
  const updateConversationMessages = useCallback(
    (convId: string, newMessages: ChatMessage[]) => {
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
        user_id: user?.id || 0,
      };
      try {
        if (!accessToken) throw new Error("No token");
        const res = await fetch(`${API_BASE}/api/conversations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
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
    [accessToken, user]
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
      if (!accessToken) return;
      await fetch(`${API_BASE}/api/conversations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      /* fire & forget */
    }
  }, [accessToken]);

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

      const userMsg: ChatMessage = {
        id: uid("user"),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
        status: "done",
        edited: false,
        bookmarked: false,
        attachments: [],
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

      if (!accessToken) {
        notify("Not authenticated", "error");
        setIsLoading(false);
        return;
      }

      try {
        abortRef.current = new AbortController();
        const response = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream, application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: trimmed,
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
          const placeholder: ChatMessage = {
            id: assistantId,
            role: "assistant",
            content: "",
            createdAt: new Date().toISOString(),
            status: "streaming",
            edited: false,
            bookmarked: false,
            attachments: [],
            model: "Vatsa AI",
          };
          updateConversationMessages(convId, [...withUser, placeholder]);

          const flush = () => {
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
          
          // Update final message
          updateConversationMessages(convId, 
            conversationsRef.current.find((c) => c.id === convId)?.messages.map((m) =>
              m.id === assistantId ? { ...m, content: text, status: "done" } : m
            ) || []
          );
        } else {
          /* ── Non-streaming path ── */
          const data = await response.json();
          const normalized = normalizeResponse(data);
          text = normalized.text;
          parsedFiles = normalized.files;

          const assistantMsg: ChatMessage = {
            id: uid("assistant"),
            role: "assistant",
            content: text || "Done.",
            createdAt: new Date().toISOString(),
            status: "done",
            edited: false,
            bookmarked: false,
            attachments: [],
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
              status: "stopped",
              edited: false,
              bookmarked: false,
              attachments: [],
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
              status: "error",
              edited: false,
              bookmarked: false,
              attachments: [],
            },
          ]);
        }
      } finally {
        if (mountedRef.current) setIsLoading(false);
        abortRef.current = null;
      }
    },
    [isLoading, model, updateConversationMessages, createProject, notify, accessToken]
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
    logout();
    router.push("/auth/login");
  }, [logout, router]);

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
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "user") {
        sendMessage(msgs[i].content, { regenerateFrom: i });
        return;
      }
    }
  }, [sendMessage]);

  /* Edit user message */
  const editUserMessage = useCallback((msg: ChatMessage) => {
    setInputValue(msg.content);
    inputRef.current?.focus();
  }, []);

  /* Keyboard shortcuts */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      if (ctrl && !shift && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
        return;
      }
      if (e.key === "Escape") {
        setCommandOpen(false);
      }
      if (ctrl && shift && e.key.toLowerCase() === "o") {
        e.preventDefault();
        handleNewProject();
      }
      if (ctrl && !shift && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
      if (ctrl && shift && e.key.toLowerCase() === "r") {
        e.preventDefault();
        regenerateLast();
      }
      if (ctrl && !shift && e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNewProject, toggleSidebar, regenerateLast]);

  /* Content click focuses input */
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
  if (isLoadingConversations) {
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
          <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
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
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const QUICK_SUGGESTIONS = [
    { label: "Build a website", icon: <Globe className="h-4 w-4" /> },
    { label: "Create a React component", icon: <Code className="h-4 w-4" /> },
    { label: "Write an API server", icon: <Folder className="h-4 w-4" /> },
    { label: "Fix a bug", icon: <Bug className="h-4 w-4" /> },
    { label: "Explain code", icon: <BookOpen className="h-4 w-4" /> },
    { label: "Design a dashboard", icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <>
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
              <button
                onClick={() => router.push("/")}
                className="rounded px-2 py-1 text-xs transition-all hover:bg-accent/10"
              >
                Chat
              </button>
              <button
                onClick={() => router.push("/code")}
                className={cn(
                  "rounded px-2 py-1 text-xs transition-all",
                  pathname === "/code"
                    ? "bg-accent/20 text-foreground"
                    : "text-muted-foreground/40 hover:bg-accent/10 hover:text-foreground"
                )}
              >
                Code
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCommandOpen(true)}
                aria-label={`Command palette (${MOD_KEY}+K)`}
                className="rounded p-1 text-muted-foreground/60 hover:bg-accent/10 hover:text-foreground"
              >
                <CommandIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() =>
                  handleThemeChange(theme === "dark" ? "light" : "dark")
                }
                aria-label="Toggle theme"
                className="rounded p-1 text-muted-foreground/60 hover:bg-accent/10 hover:text-foreground"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            <Sidebar
              projects={conversations}
              activeProjectId={activeProjectId}
              setActiveProject={handleUserSwitchProject}
              userProfile={user ? { full_name: user.full_name, email: user.email } : null}
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
                        <img
                          src="/vatsaAi.png"
                          alt="Vatsa AI"
                          width={224}
                          height={224}
                          className="rounded-full object-cover"
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
                          <button
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
                            aria-label="Attach file"
                            className="rounded p-1 text-muted-foreground/60 hover:bg-accent/10 hover:text-foreground"
                          >
                            <PlusCircle className="h-4 w-4" />
                          </button>
                          <button
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
