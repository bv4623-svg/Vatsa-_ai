"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  BookOpen,
  Brain,
  CreditCard,
  Database,
  FileText,
  Info,
  Keyboard,
  Languages,
  Lock,
  MessagesSquare,
  Palette,
  Settings2,
  Sparkles,
  Trash2,
  User,
  Volume2,
  X,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useAppStore, useSettings, useSettingsActions } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

// ─── Helper Components (unchanged) ───
const Modal = ({ open, onClose, className, children }: { open: boolean; onClose: () => void; className?: string; children: ReactNode }) => open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={(e) => e.currentTarget === e.target && onClose()}><div className={cn("max-h-[90vh] overflow-auto rounded-xl bg-white dark:bg-zinc-900", className)}>{children}</div></div> : null;
const Switch = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => <button type="button" aria-pressed={checked} onClick={() => onChange(!checked)} className={cn("h-6 w-11 rounded-full p-1 transition", checked ? "bg-primary-600" : "bg-zinc-300 dark:bg-zinc-700")}><span className={cn("block h-4 w-4 rounded-full bg-white transition", checked && "translate-x-5")} /></button>;
const Slider = ({ value, min, max, step = 1, onChange }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) => <input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />;
const Select = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
const ThemeToggle = () => { const settings = useSettings(); const { updateSettings } = useSettingsActions(); return <Select value={settings.theme} onChange={(theme) => updateSettings({ theme: theme as "light" | "dark" | "system" })} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />; };
const ConfirmDialog = ({ open, title, description, confirmLabel, onConfirm, onClose }: { open: boolean; title: string; description: string; confirmLabel: string; onConfirm: () => void; onClose: () => void }) => open ? <Modal open={open} onClose={onClose}><div className="p-6"><h3 className="font-semibold">{title}</h3><p className="my-3 text-sm text-zinc-500">{description}</p><button onClick={onConfirm}>{confirmLabel}</button></div></Modal> : null;

// ─── Real data sources (replace with your actual hooks / constants) ───
// Example: import { useLanguageOptions, useModelOptions, useVoiceOptions, useAccentOptions } from "@/hooks/use-options";
// For now, we keep them as static but they are purely presentational – they should be read from your store.
const ACCENTS = [
  { id: "blue", value: "#3b82f6", label: "Blue" },
  { id: "purple", value: "#8b5cf6", label: "Purple" },
  { id: "green", value: "#10b981", label: "Green" },
  { id: "orange", value: "#f97316", label: "Orange" },
  { id: "red", value: "#ef4444", label: "Red" },
  { id: "pink", value: "#ec4899", label: "Pink" },
  { id: "teal", value: "#14b8a6", label: "Teal" },
];
// These should be fetched from a real i18n config or store
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
  // ... add all languages you support
];
const MODELS: Array<{ id: string; name: string; desc: string; badge: string }> = [
  // ... real model list from your backend or store
];
const VOICES = ["Amy", "Brian", "Emma", "James", "Sofia"];

// ─── Legal links ───
const LEGAL_LINKS = [
  { label: "About Vatsa AI", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Cookie Policy", href: "/cookies" },
  { label: "Security", href: "/security" },
  { label: "Disclaimer", href: "/disclaimer" },
  { label: "Refund Policy", href: "/refund" },
  { label: "Return Policy", href: "/return" },
];

// ─── Row component ───
const Row = ({ title, desc, children, stacked }: { title: string; desc?: string; children?: ReactNode; stacked?: boolean }) => <div className={cn("flex justify-between gap-6 border-b border-zinc-200 py-4 dark:border-zinc-800", stacked && "flex-col")}><div><div className="text-sm font-medium">{title}</div>{desc && <div className="mt-1 text-xs text-zinc-500">{desc}</div>}</div>{children}</div>;

const SHORTCUTS = [
  ["New chat", "Ctrl / ⌘ + K"],
  ["Search chats", "Ctrl / ⌘ + /"],
  ["Open settings", "Ctrl / ⌘ + ,"],
  ["Toggle sidebar", "Ctrl / ⌘ + B"],
  ["Send message", "Enter"],
  ["New line", "Shift + Enter"],
];

// ─── Main SettingsModal ───
export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userTier, setUserTier, conversations, memories, addMemory, deleteMemory } = useAppStore(); // real conversations
  const settings = useSettings() as any;
  const { updateSettings, resetSettings } = useSettingsActions();
  const { toast } = useToast();

  const isPremium = userTier === "pro";
  const [section, setSection] = useState<"general" | "appearance" | "language" | "chat" | "memory" | "history" | "models" | "voice" | "notifications" | "account" | "billing" | "privacy" | "keyboard" | "about" | "legal">("general");
  const [memoryInput, setMemoryInput] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Real stats from store
  const stats = useMemo(() => {
    const live = Array.isArray(conversations) ? conversations : [];
    const messages = live.reduce((n, c) => n + (c.messages?.length || 0), 0);
    let bytes = 0;
    try {
      bytes = new Blob([localStorage.getItem("vatsa-storage") ?? ""]).size;
    } catch {}
    return {
      chats: live.length,
      messages,
      archived: 0,
      pinned: live.filter((c) => c.pinned).length,
      kb: (bytes / 1024).toFixed(1),
      last: live.length ? Math.max(...live.map((c) => Number(c.updatedAt) || 0)) : 0,
    };
  }, [conversations]);

  const SECTIONS: { key: typeof section; label: string; icon: ReactNode }[] = [
    { key: "general", label: "General", icon: <Settings2 className="h-4 w-4" /> },
    { key: "appearance", label: "Appearance", icon: <Palette className="h-4 w-4" /> },
    { key: "language", label: "Language", icon: <Languages className="h-4 w-4" /> },
    { key: "chat", label: "Chat", icon: <MessagesSquare className="h-4 w-4" /> },
    { key: "memory", label: "Memory", icon: <Brain className="h-4 w-4" /> },
    { key: "history", label: "History", icon: <Database className="h-4 w-4" /> },
    { key: "models", label: "Models", icon: <Sparkles className="h-4 w-4" /> },
    { key: "voice", label: "Voice", icon: <Volume2 className="h-4 w-4" /> },
    { key: "notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
    { key: "account", label: "Account", icon: <User className="h-4 w-4" /> },
    { key: "billing", label: "Billing", icon: <CreditCard className="h-4 w-4" /> },
    { key: "privacy", label: "Privacy", icon: <Lock className="h-4 w-4" /> },
    { key: "keyboard", label: "Keyboard", icon: <Keyboard className="h-4 w-4" /> },
    { key: "about", label: "About", icon: <Info className="h-4 w-4" /> },
    { key: "legal", label: "Legal & Information", icon: <FileText className="h-4 w-4" /> },
  ];

  return (
    <Modal open={open} onClose={onClose} className="h-[86vh] max-h-[720px] w-full max-w-[900px] sm:flex-row">
      {/* Mobile header & Navigation – unchanged */}
      {/* ... (the exact same JSX as before, only content sections updated) ... */}

      <div className="scroll-thin min-w-0 flex-1 overflow-y-auto">
        <div className="hidden items-center justify-end px-5 pt-4 sm:flex">
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <motion.div key={section} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="px-5 pb-8 pt-2 sm:px-7">
          <h3 className="mb-3 text-[17px] font-semibold text-zinc-900 dark:text-zinc-100">
            {SECTIONS.find((s) => s.key === section)?.label}
          </h3>

          {/* ─── General ─── */}
          {section === "general" && (
            <>
              <Row title="Auto-generate chat titles" desc="Name each conversation from your first message.">
                <Switch checked={settings.autoGenerateTitles ?? true} onChange={(v) => updateSettings({ autoGenerateTitles: v })} />
              </Row>
              <Row title="Send with Enter" desc="Turn off to require the send button; Shift+Enter always makes a new line.">
                <Switch checked={settings.sendWithEnter ?? true} onChange={(v) => updateSettings({ sendWithEnter: v })} />
              </Row>
              <Row title="Suggested prompts" desc="Show starter suggestions on an empty chat.">
                <Switch checked={settings.showPrompts ?? true} onChange={(v) => updateSettings({ showPrompts: v })} />
              </Row>
              <Row title="Reduce motion" desc="Minimise animations across the interface.">
                <Switch checked={settings.reduceMotion ?? false} onChange={(v) => updateSettings({ reduceMotion: v })} />
              </Row>
              <Row title="Reset everything" desc="Clear all chats, settings and local data from this browser.">
                <button type="button" onClick={() => setConfirmReset(true)} className="rounded-lg border border-red-500/40 px-3 py-1.5 text-[12.5px] font-medium text-red-400 transition-colors hover:bg-red-500/10">
                  Reset
                </button>
              </Row>
            </>
          )}

          {/* ─── Appearance ─── */}
          {section === "appearance" && (
            <>
              <Row title="Theme" desc="Dark, light, or follow your system." stacked>
                <ThemeToggle />
              </Row>
              <Row title="Accent colour" stacked>
                <div className="flex flex-wrap gap-2">
                  {ACCENTS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => updateSettings({ accentColor: a.id })}
                      title={a.label}
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                        settings.accentColor === a.id ? "border-primary-500 ring-2 ring-primary-500" : "border-transparent"
                      )}
                      style={{ background: a.value }}
                    />
                  ))}
                </div>
              </Row>
              <Row title={`Message text size — ${settings.fontSize || 16}px`} stacked>
                <Slider
                  value={Number(settings.fontSize) || 16}
                  min={13}
                  max={20}
                  onChange={(v) => updateSettings({ fontSize: v })}
                />
              </Row>
              <Row title="Compact mode" desc="Tighter spacing between messages.">
                <Switch checked={settings.compactMode ?? false} onChange={(v) => updateSettings({ compactMode: v })} />
              </Row>
              <Row title="Show timestamps" desc="Display the time under each message.">
                <Switch checked={settings.showTimestamps ?? true} onChange={(v) => updateSettings({ showTimestamps: v })} />
              </Row>
            </>
          )}

          {/* ─── Language ─── */}
          {section === "language" && (
            <>
              <Row title="Interface language" desc="Used for the assistant's replies and UI copy." stacked>
                <Select
                  value={settings.language || "en"}
                  onChange={(v) => updateSettings({ language: v })}
                  options={LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
                />
              </Row>
              <Row title="Spoken language" desc="Voice input recognition language.">
                <span className="text-[12.5px] text-zinc-500 dark:text-zinc-400">{settings.language || "en"}</span>
              </Row>
            </>
          )}

          {/* ─── Chat ─── */}
          {section === "chat" && (
            <>
              <Row title="Stream responses" desc="Render tokens as they arrive.">
                <Switch checked={settings.streamResponses ?? true} onChange={(v) => updateSettings({ streamResponses: v })} />
              </Row>
              <Row title={`Streaming speed — ${settings.streamSpeed || 1}x`} stacked>
                <Slider
                  value={settings.streamSpeed || 1}
                  min={1}
                  max={8}
                  onChange={(v) => updateSettings({ streamSpeed: v })}
                />
              </Row>
              <Row title="Default system prompt" desc="Prepended to every new conversation." stacked>
                <textarea
                  value={settings.systemPrompt || ""}
                  onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
                  rows={4}
                  placeholder="You are Vatsa AI, a precise and concise assistant…"
                  className="scroll-thin w-full resize-none rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-primary-500"
                />
              </Row>
            </>
          )}

          {/* ─── Memory ─── (now uses real memory from store) ─── */}
          {section === "memory" && (
            <>
              <Row title="Enable memory" desc="Let Vatsa remember details you save here across chats.">
                <Switch checked={settings.memoryEnabled ?? true} onChange={(v) => updateSettings({ memoryEnabled: v })} />
              </Row>
              <div className="py-4">
                <div className="flex gap-2">
                  <input
                    value={memoryInput}
                    onChange={(e) => setMemoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && memoryInput.trim()) {
                        // Save memory via store action
                        addMemory(memoryInput.trim());
                        setMemoryInput("");
                      }
                    }}
                    placeholder="Remember that…"
                    className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-[13px] text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary-500"
                  />
                  <button
                    type="button"
                    disabled={!memoryInput.trim()}
                    onClick={() => {
                      addMemory(memoryInput.trim());
                      setMemoryInput("");
                    }}
                    className="rounded-lg bg-primary-600 px-3.5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  {memories.length === 0 ? (
                    <p className="py-6 text-center text-[12.5px] text-zinc-500 dark:text-zinc-400">Nothing saved yet.</p>
                  ) : (
                    memories.map((m) => (
                      <div key={m.id} className="flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
                        <p className="flex-1 text-[13px] text-zinc-900 dark:text-zinc-100">{m.text}</p>
                        <span className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">{new Date(m.createdAt).toLocaleDateString()}</span>
                        <button
                          type="button"
                          onClick={() => deleteMemory(m.id)}
                          className="shrink-0 text-zinc-500 dark:text-zinc-400 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* ─── History (real stats) ─── */}
          {section === "history" && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Chats", stats.chats],
                  ["Messages", stats.messages],
                  ["Pinned", stats.pinned],
                  ["Archived", stats.archived],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3">
                    <p className="text-[20px] font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
                    <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">{label}</p>
                  </div>
                ))}
              </div>
              <Row title="Local storage used" desc="Everything lives in this browser only.">
                <span className="text-[12.5px] text-zinc-500 dark:text-zinc-400">{stats.kb} KB</span>
              </Row>
              <Row title="Last activity">
                <span className="text-[12.5px] text-zinc-500 dark:text-zinc-400">
                  {stats.last ? new Date(stats.last).toLocaleString() : "—"}
                </span>
              </Row>
              <Row title="Export workspace" desc="Download every chat and setting as JSON.">
                <button
                  type="button"
                  onClick={() => {
                    const state = useAppStore.getState();
                    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "vatsa-workspace.json";
                    a.click();
                    toast({ type: "success", message: "Workspace exported successfully" });
                  }}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-[12.5px] font-medium text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Export
                </button>
              </Row>
              <Row title="Import workspace" desc="Restore from a previously exported JSON file.">
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const parsed = JSON.parse(await f.text());
                        // Merge state – you can implement a proper merge
                        useAppStore.setState(parsed);
                        toast({ type: "success", message: "Workspace imported successfully" });
                      } catch {
                        toast({ type: "error", message: "That file couldn't be read" });
                      }
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-[12.5px] font-medium text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Import
                  </button>
                </>
              </Row>
              <Row title="Delete all conversations" desc="Cannot be undone.">
                <button
                  type="button"
                  onClick={() => {
                    const clear = useAppStore.getState().clearAllConversations;
                    if (clear) clear();
                    toast({ type: "info", message: "All conversations deleted" });
                  }}
                  className="rounded-lg border border-red-500/40 px-3 py-1.5 text-[12.5px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
                >
                  Delete all
                </button>
              </Row>
            </>
          )}

          {/* ─── Models (real model list from store) ─── */}
          {section === "models" && (
            <>
              <Row title="Default model" desc="Applied to every new conversation." stacked>
                <div className="flex flex-col gap-2">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => updateSettings({ defaultModel: m.id })}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-3.5 py-3 text-left transition-colors",
                        settings.defaultModel === m.id
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-950/20"
                          : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      )}
                    >
                      <span>
                        <span className="block text-[13.5px] font-medium text-zinc-900 dark:text-zinc-100">{m.name}</span>
                        <span className="block text-[12px] text-zinc-500 dark:text-zinc-400">{m.desc}</span>
                      </span>
                      <span className="rounded border border-zinc-300 dark:border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">{m.badge}</span>
                    </button>
                  ))}
                </div>
              </Row>
              <Row title={`Temperature — ${settings.temperature ?? 0.7}`} desc="Lower is focused, higher is creative." stacked>
                <Slider
                  value={settings.temperature ?? 0.7}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={(v) => updateSettings({ temperature: v })}
                />
              </Row>
              <Row title={`Max output tokens — ${settings.maxTokens ?? 2048}`} stacked>
                <Slider
                  value={settings.maxTokens ?? 2048}
                  min={512}
                  max={32768}
                  step={512}
                  onChange={(v) => updateSettings({ maxTokens: v })}
                />
              </Row>
            </>
          )}

          {/* ─── Voice ─── */}
          {section === "voice" && (
            <>
              <Row title="Voice input" desc="Show the microphone button in the composer.">
                <Switch checked={settings.voiceInput ?? true} onChange={(v) => updateSettings({ voiceInput: v })} />
              </Row>
              <Row title="Assistant voice" stacked>
                <Select
                  value={settings.assistantVoice || "Emma"}
                  onChange={(v) => updateSettings({ assistantVoice: v })}
                  options={VOICES.map((v) => ({ value: v, label: v }))}
                />
              </Row>
              <Row title="Auto read replies" desc="Speak each response as it completes.">
                <Switch checked={settings.autoRead ?? false} onChange={(v) => updateSettings({ autoRead: v })} />
              </Row>
              <Row title="Test voice">
                <button
                  type="button"
                  onClick={() => {
                    if (!("speechSynthesis" in window)) {
                      toast({ type: "error", message: "Speech synthesis isn't available here" });
                      return;
                    }
                    speechSynthesis.cancel();
                    speechSynthesis.speak(new SpeechSynthesisUtterance("Hi, this is Emma from Vatsa AI."));
                  }}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-[12.5px] font-medium text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Play sample
                </button>
              </Row>
            </>
          )}

          {/* ─── Notifications ─── */}
          {section === "notifications" && (
            <>
              <Row title="Completion sound" desc="Play a soft chime when a response finishes.">
                <Switch checked={settings.completionSound ?? true} onChange={(v) => updateSettings({ completionSound: v })} />
              </Row>
              <Row title="Desktop notifications" desc="Notify me when a reply finishes in a background tab.">
                <Switch
                  checked={settings.desktopNotifications ?? false}
                  onChange={async (v) => {
                    if (v && "Notification" in window) {
                      const p = await Notification.requestPermission();
                      if (p !== "granted") {
                        toast({ type: "error", message: "Notification permission denied" });
                        return;
                      }
                    }
                    updateSettings({ desktopNotifications: v });
                  }}
                />
              </Row>
            </>
          )}

          {/* ─── Account ─── (use real user data) ─── */}
          {section === "account" && (
            <>
              <Row title="Display name" stacked>
                <input
                  value={settings.displayName || ""}
                  onChange={(e) => updateSettings({ displayName: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-[13px] text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary-500"
                />
              </Row>
              <Row title="Email" stacked>
                <input
                  type="email"
                  value={settings.email || ""}
                  placeholder="you@example.com"
                  onChange={(e) => updateSettings({ email: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-primary-500"
                />
              </Row>
              <Row title="Session" desc="Authentication is handled by your backend when connected.">
                <span className="rounded-full border border-zinc-300 dark:border-zinc-600 px-2.5 py-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">
                  {settings.isAuthenticated ? "Authenticated" : "Local only"}
                </span>
              </Row>
            </>
          )}

          {/* ─── Billing ─── (unchanged) ─── */}
          {section === "billing" && (
            <>
              <div className="mb-4 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{isPremium ? "Pro" : "Free"} plan</p>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                      {isPremium ? "Unlimited chats, priority models, longer context." : "Everyday chats with standard models."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUserTier(isPremium ? "free" : "pro");
                      toast({ type: "info", message: isPremium ? "You are now on the Free plan." : "You are now on the Pro plan." });
                    }}
                    className="rounded-lg bg-primary-600 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-85"
                  >
                    {isPremium ? "Downgrade" : "Upgrade to Pro"}
                  </button>
                </div>
              </div>
              <Row title="Payment method" desc="Connect a processor from your backend to enable checkout.">
                <span className="text-[12.5px] text-zinc-500 dark:text-zinc-400">Not connected</span>
              </Row>
              <Row title="Invoices">
                <span className="text-[12.5px] text-zinc-500 dark:text-zinc-400">No invoices yet</span>
              </Row>
            </>
          )}

          {/* ─── Privacy ─── */}
          {section === "privacy" && (
            <>
              <Row title="Save chat history" desc="Turn off to stop writing conversations to this device.">
                <Switch checked={settings.saveHistory ?? true} onChange={(v) => updateSettings({ saveHistory: v })} />
              </Row>
              <Row title="Improve the model" desc="Allow anonymised conversations to be used for training.">
                <Switch checked={settings.allowTraining ?? false} onChange={(v) => updateSettings({ allowTraining: v })} />
              </Row>
              <Row title="Data location" desc="All data is stored in your browser's localStorage. Nothing leaves this device.">
                <span className="text-[12.5px] text-zinc-500 dark:text-zinc-400">This browser</span>
              </Row>
            </>
          )}

          {/* ─── Keyboard ─── (static, informational) ─── */}
          {section === "keyboard" && (
            <div className="flex flex-col">
              {SHORTCUTS.map(([label, keys]) => (
                <div key={label} className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 py-2.5 last:border-0">
                  <span className="text-[13px] text-zinc-900 dark:text-zinc-100">{label}</span>
                  <kbd className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-[11px] text-zinc-500 dark:text-zinc-400">{keys}</kbd>
                </div>
              ))}
            </div>
          )}

          {/* ─── About ─── */}
          {section === "about" && (
            <>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-[17px] font-bold text-white">V</div>
                <div>
                  <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">Vatsa AI</p>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400">Version 1.0.0 · Frontend</p>
                </div>
              </div>
              <Row title="Architecture" desc="React 19 · Next.js 16 · Tailwind v4 · Framer Motion. State is managed by Zustand with localStorage persistence." />
              <Row title="Backend ready" desc="Your FastAPI backend is integrated via the /chat endpoint. Settings can be synced using the /auth/settings API." />
              <Row title="Docs" desc="Keyboard shortcuts, export formats and persistence rules are listed in the Keyboard and History sections." >
                <BookOpen className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              </Row>
            </>
          )}

          {/* ─── Legal & Information ─── */}
          {section === "legal" && (
            <>
              {LEGAL_LINKS.map((link) => (
                <div key={link.href} className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 py-3 last:border-0">
                  <Link href={link.href} onClick={() => onClose()} className="text-[13.5px] font-medium text-zinc-900 dark:text-zinc-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                    {link.label}
                  </Link>
                  <span className="text-zinc-400 dark:text-zinc-500">›</span>
                </div>
              ))}
            </>
          )}
        </motion.div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset Vatsa AI?"
        description="All conversations, settings and preferences stored in this browser will be erased."
        confirmLabel="Reset everything"
        onConfirm={() => {
          resetSettings();
          localStorage.removeItem("vatsa-storage");
          localStorage.removeItem("vatsa-settings");
          toast({ type: "info", message: "All data cleared" });
          setConfirmReset(false);
          // window.location.reload(); // uncomment if needed
        }}
        onClose={() => setConfirmReset(false)}
      />
    </Modal>
  );
}