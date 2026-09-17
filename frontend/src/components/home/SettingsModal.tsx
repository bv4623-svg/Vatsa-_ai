"use client";

import { memo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Settings, Palette, Languages, Info, X, ExternalLink, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const SettingsModal = memo(({ open, onClose, settings, updateSettings, onLogout, onClearAllChats, onExportChats, isFree }: any) => {
  const router = useRouter();
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
        {isFree && (
          <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-accent/10 to-purple-500/10 px-6 py-2.5">
            <Sparkles className="h-4 w-4 flex-shrink-0 text-accent" />
            <p className="flex-1 text-xs text-foreground/80">
              You&apos;re on the Free plan. Upgrade to unlock Vision, Reasoning, Agents, and higher limits.
            </p>
            <button
              onClick={() => { onClose(); router.push("/pricing"); }}
              className="flex-shrink-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 text-xs font-medium text-white hover:opacity-90"
            >
              Upgrade to Pro
            </button>
          </div>
        )}
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
