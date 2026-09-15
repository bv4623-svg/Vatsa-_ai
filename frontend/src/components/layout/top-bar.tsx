"use client";

import { useState } from "react";
import {
  Menu,
  Bell,
  User,
  Settings,
  LogOut,
  Search,
  Sparkles,
} from "lucide-react";

interface TopBarProps {
  onSidebarToggle: () => void;
  onLogout?: () => void;
  userProfile?: { full_name: string; email: string } | null;
}

export const TopBar = ({
  onSidebarToggle,
  onLogout,
  userProfile,
}: TopBarProps) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <header className="h-16 border-b border-[#1d1d1d] bg-black/80 backdrop-blur-sm px-4 flex items-center justify-between z-20 relative">
      <div className="flex items-center gap-3">
        <button
          onClick={onSidebarToggle}
          className="p-1 rounded hover:bg-white/10 text-[#888] transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--accent)]" />
          <span className="font-semibold text-white hidden sm:inline">Vatsa</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="hidden md:flex items-center gap-1 text-xs text-[#666] bg-[#111] px-3 py-1.5 rounded-full border border-[#2a2a2a] hover:text-white transition-colors">
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
          <kbd className="ml-1 px-1.5 py-0.5 bg-zinc-800 rounded text-[10px] text-[#555]">
            ⌘K
          </kbd>
        </button>

        <button className="p-1.5 rounded hover:bg-white/10 text-[#888] hover:text-white transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent)] to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
              {userProfile?.full_name?.[0] || "U"}
            </div>
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 glass-card rounded-xl shadow-2xl p-1.5 z-50 animate-in slide-in-from-top-2">
              <div className="px-3 py-2 border-b border-[#2a2a2a]">
                <p className="text-sm text-white font-medium">
                  {userProfile?.full_name || "User"}
                </p>
                <p className="text-xs text-[#666]">
                  {userProfile?.email || "user@email.com"}
                </p>
              </div>
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#ccc] hover:bg-white/10 transition-colors">
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onLogout?.();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-400/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .glass-card {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.08);
          transition: all 0.4s ease;
        }
        .glass-card:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.2);
        }
      `}</style>
    </header>
  );
};