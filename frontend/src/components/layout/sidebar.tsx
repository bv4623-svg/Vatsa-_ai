"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PanelLeft,
  Plus,
  Search,
  Settings,
  X,
  MessageSquare,
  LogOut,
  User,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { AIIcon } from "@/components/brand/AIIcon";

export type PanelKey = never;

const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
const MOD_KEY = isMac ? "⌘" : "Ctrl";

// ─── User Profile Dropdown ───
const ProfileMenu = ({ collapsed, onOpenSettings }: any) => {
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = user?.name || "User";
  const displayEmail = user?.email || "user@vatsa.ai";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className={cn("relative", collapsed && "flex justify-center")} ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors w-full",
          collapsed && "justify-center"
        )}
      >
        <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-medium shrink-0">
          {initial}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm text-zinc-100 truncate">{displayName}</div>
              <div className="text-xs text-zinc-500 truncate">{displayEmail}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </>
        )}
      </button>
      {open && (
        <div
          className={cn(
            "absolute z-50 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1",
            collapsed ? "bottom-full left-0 mb-1 w-48" : "bottom-full left-0 mb-1 w-full"
          )}
        >
          <button
            onClick={() => { onOpenSettings(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            <User className="w-4 h-4" /> Profile
          </button>
          <button
            onClick={() => { onOpenSettings(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            <Settings className="w-4 h-4" /> Settings
          </button>
          <hr className="border-zinc-800 my-1" />
          <button
            onClick={() => { logout(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-zinc-800"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Recent Chats List ───
const ChatHistory = ({ query, showArchived, onNewChat }: any) => {
  const raw = useAppStore((state) => state.conversations);
  const conversations = Array.isArray(raw) ? raw : [];
  const activeId = useAppStore((state) => state.activeConversationId);
  const setActive = useAppStore((state) => state.setActiveConversation);
  const deleteConversation = useAppStore((state) => state.deleteConversation);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filtered = conversations.filter((c: any) => {
    const matchesQuery = c.title?.toLowerCase().includes(query.toLowerCase()) ?? false;
    const matchesArchived = showArchived ? c.archived : !c.archived;
    return matchesQuery && matchesArchived && !c.deletedAt;
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-6 text-center">
        <div className="text-zinc-500 text-sm">
          {query ? "No results found." : "No conversations yet."}
        </div>
        {!query && (
          <button
            onClick={onNewChat}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-600/20 px-4 py-1.5 text-xs font-medium text-primary-400 hover:bg-primary-600/30 transition"
          >
            <Plus className="h-3.5 w-3.5" /> Start new chat
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {filtered.slice(0, 20).map((chat: any) => (
        <div
          key={chat.id}
          className="group relative flex items-center"
          onMouseEnter={() => setHoveredId(chat.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <button
            onClick={() => setActive(chat.id)}
            className={cn(
              "flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm transition-colors text-left",
              activeId === chat.id
                ? "bg-primary-900/20 text-primary-300"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate flex-1">{chat.title || "Untitled"}</span>
          </button>
          {hoveredId === chat.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Delete this chat?")) {
                  deleteConversation(chat.id);
                }
              }}
              className="absolute right-2 p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Main Sidebar ───────────────────────────────────────
export default function Sidebar({
  mobileOpen,
  onCloseMobile,
  onNewChat,
  onOpenSettings,
  onOpenSearch,
  searchRef,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);

  const [width, setWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("sidebar-width");
      return stored ? parseInt(stored, 10) : 280;
    }
    return 280;
  });
  const SIDEBAR_MIN = 240;
  const SIDEBAR_MAX = 340;

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX));
      setWidth(w);
      localStorage.setItem("sidebar-width", String(w));
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  const isCollapsed = collapsed;
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const rawConversations = useAppStore((state) => state.conversations);
  const conversations = Array.isArray(rawConversations) ? rawConversations : [];
  const archivedCount = conversations.filter((c: any) => c.archived && !c.deletedAt).length;

  const body = (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Logo & Collapse */}
      <div className={cn("flex items-center gap-3 px-3 pt-3", isCollapsed && "flex-col")}>
        {!isCollapsed && (
          <div className="flex min-w-0 flex-1 items-center gap-3 px-1">
            <AIIcon size={28} className="shrink-0" />
            <span className="truncate text-[15px] font-semibold tracking-tight text-white">Vatsa AI</span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className={cn(
            "p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white",
            "hidden md:inline-flex"
          )}
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          <PanelLeft className="h-[18px] w-[18px]" />
        </button>
        <button
          onClick={onCloseMobile}
          className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white md:hidden"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Actions */}
      <div className={cn("flex flex-col gap-2 px-3 pt-3", isCollapsed && "items-center")}>
        {isCollapsed ? (
          <button
            onClick={onNewChat}
            className="h-9 w-9 p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
            title="New Chat"
          >
            <Plus className="h-[18px] w-[18px]" />
          </button>
        ) : (
          <>
            <button
              onClick={onNewChat}
              className="group flex w-full items-center gap-2.5 rounded-xl border border-zinc-800 px-3 py-2.5 text-[13.5px] font-medium text-white transition-all hover:bg-zinc-800"
            >
              <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
              New Chat
              <kbd className="ml-auto text-[10px] text-zinc-500">{MOD_KEY}+K</kbd>
            </button>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setQuery("")}
                placeholder="Search chats..."
                className="w-full rounded-xl border border-transparent bg-zinc-800 py-2 pl-9 pr-8 text-[13px] text-white placeholder:text-zinc-500 focus:border-zinc-700 outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Recent Chats */}
      <div ref={scrollRef} className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto px-2">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-1 pt-1" />
        ) : (
          <>
            <div className="mb-1 flex items-center justify-between px-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {query ? "Results" : "Recent"}
              </span>
              {archivedCount > 0 && (
                <button
                  onClick={() => setShowArchived((v) => !v)}
                  className="flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-white"
                >
                  {showArchived ? "Back" : `Archived (${archivedCount})`}
                </button>
              )}
            </div>
            <ChatHistory query={query} showArchived={showArchived} onNewChat={onNewChat} />
          </>
        )}
      </div>

      {/* Footer: Settings + Profile */}
      <div className={cn("border-t border-zinc-800 p-2", isCollapsed ? "flex flex-col items-center gap-1" : "flex flex-col gap-0.5")}>
        {isCollapsed ? (
          <>
            <button
              onClick={onOpenSettings}
              className="h-9 w-9 p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
              title="Settings"
            >
              <Settings className="h-[18px] w-[18px]" />
            </button>
            <ProfileMenu collapsed onOpenSettings={onOpenSettings} />
          </>
        ) : (
          <>
            <button
              onClick={onOpenSettings}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              <Settings className="h-4 w-4" />
              Settings
              <kbd className="ml-auto text-[10px] text-zinc-500">{MOD_KEY}+,</kbd>
            </button>
            <ProfileMenu onOpenSettings={onOpenSettings} />
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 60 : width }}
        transition={{ type: "spring", stiffness: 420, damping: 38 }}
        className="relative hidden shrink-0 border-r border-zinc-800 md:block bg-zinc-950"
      >
        {body}
        {!isCollapsed && (
          <div
            onMouseDown={startDrag}
            onDoubleClick={() => setWidth(280)}
            className="absolute -right-1 top-0 z-20 h-full w-2 cursor-col-resize"
          >
            <div className="mx-auto h-full w-px bg-transparent transition-colors hover:bg-primary-500/25" />
          </div>
        )}
      </motion.aside>

      {/* Mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
            />
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              className="fixed inset-y-0 left-0 z-50 w-[290px] border-r border-zinc-800 md:hidden bg-zinc-950"
            >
              {body}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}