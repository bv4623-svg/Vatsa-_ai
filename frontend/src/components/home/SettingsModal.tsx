"use client";

import { memo, useState } from "react";
import { motion } from "framer-motion";
import { useUpgrade } from "@/components/billing/UpgradeProvider";
import {
  Settings, Palette, Languages, Info, X, Sparkles,
  SlidersHorizontal, ShieldCheck, KeyRound, Link2, CreditCard, UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GeneralTab, AppearanceTab, LanguageTab, PreferencesTab, SecurityTab,
  ApiKeysTab, ConnectedAccountsTab, BillingTab, AccountTab, LegalTab,
} from "@/components/settings/tabs";

const TABS = [
  { id: "general", label: "General", icon: Settings },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "language", label: "Language", icon: Languages },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "apiKeys", label: "API Keys", icon: KeyRound },
  { id: "connections", label: "Connected accounts", icon: Link2 },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "account", label: "Account", icon: UserCog },
  { id: "legal", label: "Legal & Info", icon: Info },
] as const;

export const SettingsModal = memo(({ open, onClose, settings, updateSettings, onClearAllChats, onExportChats, isFree }: any) => {
  const { openUpgrade } = useUpgrade();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("general");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-background rounded-2xl border border-border w-[90vw] max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          <button onClick={onClose} aria-label="Close settings"><X className="w-5 h-5 text-muted-foreground hover:text-foreground" /></button>
        </div>
        {isFree && (
          <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-accent/10 to-purple-500/10 px-6 py-2.5">
            <Sparkles className="h-4 w-4 flex-shrink-0 text-accent" />
            <p className="flex-1 text-xs text-foreground/80">
              You&apos;re on the Free plan. Upgrade to unlock Vision, Reasoning, Agents, and higher limits.
            </p>
            <button
              onClick={() => { onClose(); openUpgrade({ source: "settings", reason: "Unlock higher daily limits and every Pro feature." }); }}
              className="flex-shrink-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 text-xs font-medium text-white hover:opacity-90"
            >
              Upgrade to Pro
            </button>
          </div>
        )}
        <div className="flex flex-1 overflow-hidden">
          <div className="w-44 border-r border-border p-2 space-y-1 overflow-y-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  activeTab === tab.id ? "bg-accent/10 text-foreground" : "text-muted-foreground hover:bg-accent/5 hover:text-foreground"
                )}
              >
                <tab.icon className="w-4 h-4 shrink-0" />
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === "general" && <GeneralTab settings={settings} updateSettings={updateSettings} onClearAllChats={onClearAllChats} onExportChats={onExportChats} />}
            {activeTab === "appearance" && <AppearanceTab settings={settings} updateSettings={updateSettings} />}
            {activeTab === "preferences" && <PreferencesTab />}
            {activeTab === "language" && <LanguageTab />}
            {activeTab === "security" && <SecurityTab />}
            {activeTab === "apiKeys" && <ApiKeysTab isFree={isFree} />}
            {activeTab === "connections" && <ConnectedAccountsTab />}
            {activeTab === "billing" && <BillingTab />}
            {activeTab === "account" && <AccountTab />}
            {activeTab === "legal" && <LegalTab />}
          </div>
        </div>
      </motion.div>
    </div>
  );
});
SettingsModal.displayName = "SettingsModal";
