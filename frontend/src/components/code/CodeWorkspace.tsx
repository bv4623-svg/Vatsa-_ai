"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/code/Sidebar";
import { CodePreviewPanel } from "@/components/code/CodePreviewPanel";
import { CommandPalette } from "@/components/code/CommandPalette";
import { CodeWorkspaceHeader } from "@/components/code/CodeWorkspaceHeader";
import { CodeWorkspaceEmptyState } from "@/components/code/CodeWorkspaceEmptyState";
import { CodeChatPanel } from "@/components/code/CodeChatPanel";
import { useAuthStore, useUser, useAccessToken } from "@/stores/auth";
import { useToasts } from "@/hooks/useToasts";
import { useAutoResize } from "@/hooks/useAutoResize";
import { useCodeConversations } from "@/hooks/code/useCodeConversations";
import { useCodeChat } from "@/hooks/code/useCodeChat";
import { useWorkspaceTheme } from "@/hooks/code/useWorkspaceTheme";
import { useUpgrade } from "@/components/billing/UpgradeProvider";
import { clearSession } from "@/lib/session";
import type { UpgradeGateInfo } from "@/lib/billing/upgradeError";
import type { ProjectFile, PreviewMode } from "@/types/code";

const isMac =
  typeof navigator !== "undefined" &&
  navigator.platform.toUpperCase().indexOf("MAC") >= 0;
const MOD_KEY = isMac ? "⌘" : "Ctrl";

const EMPTY_FILE: ProjectFile = { name: "index.html", content: "" };

/* ──────────────────────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────────────────────── */
export function CodeWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useUser();
  const accessToken = useAccessToken();
  const logout = useAuthStore((s) => s.logout);

  const { toasts, push: notify, dismiss: dismissToast } = useToasts();

  const [fatalError] = useState<string | null>(null);

  /* UI state */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [model, setModel] = useState<string>("auto");

  const tier: "free" | "pro" | "ultra" = (user?.tier as any) || "free";
  const isFree = tier === "free";
  const { openUpgrade } = useUpgrade();

  const openUpgradeModal = useCallback(
    (reason: string, feature?: string, suggestedTier?: "pro" | "ultra", limitInfo?: { used: number; limit: number }) => {
      openUpgrade({ source: "feature_lock", reason, feature, suggestedTier, limitInfo });
    },
    [openUpgrade]
  );

  const handleUpgradeGate = useCallback((info: UpgradeGateInfo) => {
    const featureLabel = (info.feature || "").replace(/_/g, " ");
    if (info.error === "daily_limit_reached") {
      openUpgradeModal(
        `You've used all ${info.limit} free ${featureLabel} today.`,
        info.feature,
        "pro",
        info.used != null && info.limit != null ? { used: info.used, limit: info.limit } : undefined,
      );
    } else {
      openUpgradeModal(`${featureLabel || "This feature"} is a Pro feature.`, info.feature, info.suggestedTier || "pro");
    }
  }, [openUpgradeModal]);

  /* Workspace/preview panel state */
  const [codeContent, setCodeContent] = useState("");
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("preview");
  const [files, setFiles] = useState<ProjectFile[]>([EMPTY_FILE]);
  const [activeFile, setActiveFile] = useState(EMPTY_FILE.name);
  const [builderWidth, setBuilderWidth] = useState(40);

  const resetWorkspacePanel = useCallback(() => {
    setShowCodePanel(false);
    setCodeContent("");
    setFiles([EMPTY_FILE]);
    setActiveFile(EMPTY_FILE.name);
  }, []);

  /* Refs */
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  const {
    conversations, setConversations, activeProjectId, setActiveProjectId,
    isLoadingConversations, activeConv, currentMessages,
    conversationsRef, activeProjectIdRef,
    createProject, updateConversationMessages,
    handleDeleteProject, handleUserSwitchProject,
  } = useCodeConversations(accessToken, router, user);

  const {
    inputValue, setInputValue, isLoading, abortRef,
    sendMessage, regenerateLast, editUserMessage, onInputKeyDown,
    resetForNewProject,
  } = useCodeChat({
    accessToken,
    model,
    conversationsRef,
    activeProjectIdRef,
    setActiveProjectId,
    createProject,
    updateConversationMessages,
    setConversations,
    notify,
    onSendStart: () => setShowCodePanel(true),
    onFilesGenerated: (generatedFiles, main) => {
      setFiles(generatedFiles);
      setCodeContent(main.content);
      setActiveFile(main.name);
      setShowCodePanel(true);
      setPreviewMode("preview");
    },
    onUpgradeRequired: handleUpgradeGate,
  });

  const { theme, accentColor, setAccentColor, handleThemeChange, accentColorHex } =
    useWorkspaceTheme();

  /* Auto-resize input (empty-state textarea only) */
  useAutoResize(inputRef, inputValue, 200);

  /* Auto-scroll on new messages */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeProjectId]);

  const handleNewProject = useCallback(async () => {
    resetForNewProject();
    const id = await createProject("New Project");
    setActiveProjectId(id);
    activeProjectIdRef.current = id;
    resetWorkspacePanel();
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [createProject, resetForNewProject, resetWorkspacePanel, setActiveProjectId, activeProjectIdRef]);

  const handleLogout = useCallback(() => {
    clearSession();
    router.push("/");
  }, [router]);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((p) => !p), []);

  const onDeleteProject = useCallback(
    (id: string) => handleDeleteProject(id, resetWorkspacePanel),
    [handleDeleteProject, resetWorkspacePanel]
  );

  const onSwitchProject = useCallback(
    (id: string) => {
      handleUserSwitchProject(id, () => {
        abortRef.current?.abort();
        resetWorkspacePanel();
        setInputValue("");
      });
    },
    [handleUserSwitchProject, abortRef, resetWorkspacePanel, setInputValue]
  );

  const onFileAttached = useCallback((file: ProjectFile) => {
    setFiles([file]);
    setActiveFile(file.name);
    if (/\.html?$/i.test(file.name)) setCodeContent(file.content);
    setShowCodePanel(true);
    setPreviewMode("preview");
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

  /* Command palette commands */
  const paletteCommands = useMemo(
    () => [
      { id: "new", label: "New Project", hint: `${MOD_KEY}+Shift+O`, run: handleNewProject },
      { id: "sidebar", label: "Toggle Sidebar", hint: `${MOD_KEY}+B`, run: toggleSidebar },
      { id: "regen", label: "Regenerate Last Response", hint: `${MOD_KEY}+Shift+R`, run: regenerateLast },
      { id: "theme-dark", label: "Theme: Dark", run: () => handleThemeChange("dark") },
      { id: "theme-light", label: "Theme: Light", run: () => handleThemeChange("light") },
      { id: "theme-system", label: "Theme: System", run: () => handleThemeChange("system") },
      { id: "accent-purple", label: "Accent: Purple", run: () => setAccentColor("purple") },
      { id: "accent-blue", label: "Accent: Blue", run: () => setAccentColor("blue") },
      { id: "accent-green", label: "Accent: Green", run: () => setAccentColor("green") },
      { id: "logout", label: "Sign Out", run: handleLogout },
    ],
    [handleNewProject, toggleSidebar, regenerateLast, handleThemeChange, handleLogout, setAccentColor]
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
          <CodeWorkspaceHeader
            pathname={pathname}
            theme={theme}
            modKey={MOD_KEY}
            onNavigateChat={() => router.push("/")}
            onNavigateCode={() => router.push("/code")}
            onOpenCommandPalette={() => setCommandOpen(true)}
            onToggleTheme={() => handleThemeChange(theme === "dark" ? "light" : "dark")}
            tier={tier}
            onUpgradeClick={() => openUpgrade({ source: "code_header", reason: "Unlock higher daily limits and every Pro feature." })}
          />

          <div className="flex flex-1 overflow-hidden">
            <Sidebar
              projects={conversations}
              activeProjectId={activeProjectId}
              setActiveProject={onSwitchProject}
              userProfile={user ? { full_name: user.full_name, email: user.email } : null}
              onLogout={handleLogout}
              onNewProject={handleNewProject}
              collapsed={sidebarCollapsed}
              toggleSidebar={toggleSidebar}
              onDeleteProject={onDeleteProject}
              isFree={isFree}
            />

            <div
              ref={mainContentRef}
              className="flex-1 cursor-text overflow-y-auto bg-background/40 backdrop-blur-sm"
              onClick={handleContentClick}
            >
              {showEmptyState ? (
                <CodeWorkspaceEmptyState
                  inputRef={inputRef}
                  inputValue={inputValue}
                  setInputValue={setInputValue}
                  isLoading={isLoading}
                  onInputKeyDown={onInputKeyDown}
                  sendMessage={sendMessage}
                  notify={notify}
                  onFileAttached={onFileAttached}
                />
              ) : (
                <div className="flex h-full">
                  <CodeChatPanel
                    widthPercent={builderWidth}
                    messages={currentMessages}
                    isLoading={isLoading}
                    messagesEndRef={messagesEndRef}
                    inputValue={inputValue}
                    setInputValue={setInputValue}
                    onInputKeyDown={onInputKeyDown}
                    model={model}
                    setModel={setModel}
                    sendMessage={sendMessage}
                    stopGeneration={() => {
                      abortRef.current?.abort();
                    }}
                    notify={notify}
                    editUserMessage={(msg) => editUserMessage(msg, inputRef)}
                    regenerateLast={regenerateLast}
                  />

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
                      isFree={isFree}
                      onUpgradeClick={() => openUpgrade({ source: "code_preview", reason: "Keep the live preview unlocked with Pro.", feature: "code_preview", suggestedTier: "pro" })}
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
                {t.kind === "error" && <AlertCircle className="h-4 w-4" />}
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
