"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader, Lock, Shield, CheckCircle2, AlertCircle, X, Sparkles, Star, Building2 } from "lucide-react";
import { getPlan } from "@/data/plans";

import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { MOD_KEY } from "@/lib/home/constants";
import { useHomeTheme } from "@/hooks/home/useHomeTheme";
import { useHomeConversations } from "@/hooks/home/useHomeConversations";
import { useHomeChat } from "@/hooks/home/useHomeChat";
import { useAttachments } from "@/hooks/home/useAttachments";
import { useVisionAnalysis } from "@/hooks/home/useVisionAnalysis";
import { Sidebar } from "@/components/home/Sidebar";
import { SettingsModal } from "@/components/home/SettingsModal";
import { ChatEmptyState } from "@/components/home/ChatEmptyState";
import { ChatMessagesView } from "@/components/home/ChatMessagesView";
import { UsageBar } from "@/components/billing/UsageBar";
import { UpgradeBanner } from "@/components/billing/UpgradeBanner";
import { useUpgrade } from "@/components/billing/UpgradeProvider";
import { clearSession } from "@/lib/session";
import type { UpgradeGateInfo } from "@/hooks/home/useHomeChat";

const CommandPalette = dynamic(
  () => import("@/components/layout/command-palette").then(mod => mod.CommandPalette),
  { ssr: false }
);
const ToastContainer = dynamic(
  () => import("@/components/ui/toast").then(mod => mod.ToastContainer),
  { ssr: false }
);

import Background from "@/components/landing/Background";

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();

  const {
    sidebarCollapsed, draftMessage, user, setUser,
    setSidebarCollapsed, setDraftMessage, setScrollPosition,
  } = useAppStore();

  const [inputValue, setInputValue] = useState(draftMessage || "");
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [privateMode, setPrivateMode] = useState(false);
  const [selectedModel] = useState("auto");
  const [currentWorkspace] = useState("personal");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showShortcutHelper, setShowShortcutHelper] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [errorState, setErrorState] = useState<{ message: string; stack?: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showWebSearchPopover, setShowWebSearchPopover] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [reasoningEnabled, setReasoningEnabled] = useState(false);
  const [showVoicePopover, setShowVoicePopover] = useState(false);

  const tier: "free" | "pro" | "business" = user?.tier || "free";
  const isFree = tier === "free";
  const { openUpgrade } = useUpgrade();
  const [bannerDismissedAtCount, setBannerDismissedAtCount] = useState<number | null>(null);

  const openUpgradeModal = useCallback(
    (reason: string, feature?: string, suggestedTier?: "pro" | "business", limitInfo?: { used: number; limit: number }) => {
      openUpgrade({ source: "feature_lock", reason, feature, suggestedTier, limitInfo });
    },
    [openUpgrade]
  );

  const handleToggleReasoning = useCallback(() => {
    if (isFree) {
      openUpgradeModal("Reasoning (step-by-step thinking) is a Pro feature.", "reasoning", "pro");
      return;
    }
    setReasoningEnabled((v) => !v);
  }, [isFree, openUpgradeModal]);

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

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const { theme, handleThemeChange, accentColor, setAccentColor, accentColorHex, fontSize, setFontSize, fontSizePx, setLanguage } =
    useHomeTheme();

  const {
    conversations, activeConversationId, setActiveConversationId,
    activeConv, messages, loading,
    updateConversation, addMessageToConversation,
    handleNewChat, handleDeleteChat, handleClearAllChats, handleExportChats,
    handleRenameChat, handlePinChat, handleUnpinChat, handleToggleFavorite,
    handleDuplicateChat, handleArchiveChat,
  } = useHomeConversations({ router, setUser, setDraftMessage, setErrorState });

  const showUpgradeBanner =
    isFree && messages.length >= 5 && (bannerDismissedAtCount == null || messages.length >= bannerDismissedAtCount + 10);

  const {
    attachments, setAttachments, showAttachmentMenu, setShowAttachmentMenu,
    fileInputRef, folderInputRef, handleFileUpload, removeAttachment,
  } = useAttachments();

  const { analyzingId, analyzeImage } = useVisionAnalysis({
    activeConversationId, handleNewChat, addMessageToConversation, setErrorState,
  });

  const resetComposerForNewChat = useCallback(() => {
    setInputValue("");
    setIsFirstMessage(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const onNewChat = useCallback(
    () => handleNewChat(resetComposerForNewChat),
    [handleNewChat, resetComposerForNewChat]
  );

  const {
    isLoading, isImageGenLoading, feedback, copiedMsgId, abortControllerRef,
    sendMessage, handleRetry, handleRegenerate, handleCopy, handleFeedback, handleShare,
  } = useHomeChat({
    activeConversationId, conversations, messages, privateMode, user,
    attachments, setAttachments, webSearchEnabled, reasoningEnabled, addMessageToConversation, updateConversation, handleRenameChat,
    handleNewChat: onNewChat, setDraftMessage, setInputValue, setIsFirstMessage, setErrorState,
    onUpgradeRequired: handleUpgradeGate,
  });

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed(!sidebarCollapsed);
  }, [sidebarCollapsed, setSidebarCollapsed]);

  const handleLogout = useCallback(() => {
    clearSession();
    router.push("/");
  }, [router]);

  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setDraftMessage(value);
    const target = e.target;
    target.style.height = "auto";
    target.style.height = Math.min(target.scrollHeight, 300) + "px";
  }, [setDraftMessage]);

  const onStopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, [abortControllerRef]);

  const onRegenerate = useCallback(
    (msgId: string) => handleRegenerate(msgId, updateConversation),
    [handleRegenerate, updateConversation]
  );

  const onSuggestionClick = useCallback((text: string) => {
    setInputValue(text);
    setDraftMessage(text);
  }, [setDraftMessage]);

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "k") { e.preventDefault(); document.dispatchEvent(new CustomEvent("vatsa-command-palette")); }
      if (e.key === "?" && !ctrl) { e.preventDefault(); setShowShortcutHelper(true); }
      if (ctrl && e.key === "b") { e.preventDefault(); handleToggleSidebar(); }
      if (ctrl && e.key === "j") { e.preventDefault(); setIsNotificationCenterOpen((p) => !p); }
      if (ctrl && e.key === "Enter") { e.preventDefault(); if (inputValue.trim()) sendMessage(inputValue); }
      if (ctrl && e.key === "n") { e.preventDefault(); onNewChat(); }
      if (ctrl && e.key === ",") { e.preventDefault(); setIsSettingsOpen(true); }
      if (ctrl && e.key === "u") { e.preventDefault(); fileInputRef.current?.click(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [inputValue, sendMessage, onNewChat, handleToggleSidebar, fileInputRef]);

  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  useEffect(() => {
    if (activeConv && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [activeConversationId, activeConv]);

  useEffect(() => {
    const handleScroll = () => {
      if (chatContainerRef.current) setScrollPosition(chatContainerRef.current.scrollTop);
    };
    const container = chatContainerRef.current;
    container?.addEventListener("scroll", handleScroll);
    return () => container?.removeEventListener("scroll", handleScroll);
  }, [setScrollPosition]);

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
            <div className="flex items-center gap-1">
              {tier === "business" ? (
                <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 px-2.5 py-1 text-[11px] font-medium text-cyan-400">
                  <Building2 className="h-3 w-3" /> {getPlan("business")?.name ?? "Business"}
                </div>
              ) : tier === "pro" ? (
                <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-2.5 py-1 text-[11px] font-medium text-purple-400">
                  <Star className="h-3 w-3" /> Pro
                </div>
              ) : (
                <button
                  onClick={() => openUpgrade({ source: "chat_header", reason: "Unlock higher daily limits and every Pro feature." })}
                  className="flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 text-[11px] font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Sparkles className="h-3 w-3" /> Upgrade to Pro
                </button>
              )}
            </div>
          </header>

          {isFree && <UsageBar usage={user?.usage} />}

          <div className="flex flex-1 overflow-hidden">
            <Sidebar
              mobileOpen={isSidebarOpen}
              onCloseMobile={() => setIsSidebarOpen(false)}
              onNewChat={onNewChat}
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
              isFree={isFree}
            />

            <div className="flex-1 overflow-y-auto bg-background/40 backdrop-blur-sm">
              {isEmpty ? (
                <ChatEmptyState
                  inputRef={inputRef}
                  inputValue={inputValue}
                  onInputChange={handleInputChange}
                  onSuggestionClick={onSuggestionClick}
                  onSend={() => sendMessage(inputValue)}
                  hasReadyAttachments={hasReadyAttachments}
                  attachments={attachments}
                  removeAttachment={removeAttachment}
                  onAnalyzeImage={analyzeImage}
                  analyzingImageId={analyzingId}
                  showAttachmentMenu={showAttachmentMenu}
                  setShowAttachmentMenu={setShowAttachmentMenu}
                  showWebSearchPopover={showWebSearchPopover}
                  setShowWebSearchPopover={setShowWebSearchPopover}
                  webSearchEnabled={webSearchEnabled}
                  onToggleWebSearch={() => { setWebSearchEnabled((v) => !v); setShowWebSearchPopover(false); }}
                  reasoningEnabled={reasoningEnabled}
                  onToggleReasoning={handleToggleReasoning}
                  isFree={isFree}
                  showVoicePopover={showVoicePopover}
                  setShowVoicePopover={setShowVoicePopover}
                  fileInputRef={fileInputRef}
                  folderInputRef={folderInputRef}
                  onFileUpload={handleFileUpload}
                />
              ) : (
                <ChatMessagesView
                  messages={messages}
                  isLoading={isLoading}
                  isImageGenLoading={isImageGenLoading}
                  copiedMsgId={copiedMsgId}
                  feedback={feedback}
                  onCopy={handleCopy}
                  onRegenerate={onRegenerate}
                  onFeedback={handleFeedback}
                  onShare={handleShare}
                  messagesEndRef={messagesEndRef}
                  chatContainerRef={chatContainerRef}
                  attachments={attachments}
                  removeAttachment={removeAttachment}
                  onAnalyzeImage={analyzeImage}
                  analyzingImageId={analyzingId}
                  inputRef={inputRef}
                  inputValue={inputValue}
                  onInputChange={handleInputChange}
                  onSend={() => sendMessage(inputValue)}
                  onStop={onStopGeneration}
                  hasReadyAttachments={hasReadyAttachments}
                  showAttachmentMenu={showAttachmentMenu}
                  setShowAttachmentMenu={setShowAttachmentMenu}
                  webSearchEnabled={webSearchEnabled}
                  onToggleWebSearch={() => setWebSearchEnabled((v) => !v)}
                  reasoningEnabled={reasoningEnabled}
                  onToggleReasoning={handleToggleReasoning}
                  isFree={isFree}
                  fileInputRef={fileInputRef}
                  folderInputRef={folderInputRef}
                  onFileUpload={handleFileUpload}
                  modKey={MOD_KEY}
                  banner={
                    showUpgradeBanner ? (
                      <UpgradeBanner onDismiss={() => setBannerDismissedAtCount(messages.length)} />
                    ) : undefined
                  }
                />
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
            isFree={isFree}
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
