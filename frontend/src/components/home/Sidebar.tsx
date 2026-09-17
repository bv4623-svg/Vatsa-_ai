"use client";

import { memo, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  Archive, Copy, Settings, Plus, X, Search,
  PanelLeft, MessageSquare, Pencil, Pin, Star, Trash2,
  MoreHorizontal, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IconBtn } from "@/components/home/IconBtn";
import { DeleteConfirmModal } from "@/components/home/DeleteConfirmModal";
import { RenameModal } from "@/components/home/RenameModal";
import { SidebarUpgradeCard } from "@/components/billing/SidebarUpgradeCard";

export const Sidebar = memo(({
  onNewChat, onOpenSettings, conversations, collapsed, toggleSidebar, width,
  privateMode, onDeleteChat, onLogout, userProfile, onRenameChat, onPinChat,
  onUnpinChat, onToggleFavorite, onDuplicateChat, onArchiveChat,
  activeConversationId, setActiveConversation, isFree,
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

          {isFree && (
            <div className={cn("pb-2", isCollapsed ? "px-2" : "px-1")}>
              <SidebarUpgradeCard collapsed={isCollapsed} />
            </div>
          )}

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
