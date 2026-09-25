"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  LogOut, Plus, Search, X, PanelLeft, Folder, Trash2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/services/chat";
import type { UserProfile } from "@/types/code";
import { SidebarUpgradeCard } from "@/components/billing/SidebarUpgradeCard";
import { SidebarWorkspaceLinks } from "@/components/sidebar/SidebarWorkspaceLinks";
import { AIIcon } from "@/components/brand/AIIcon";

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
  isFree?: boolean;
  onOpenSettings?: () => void;
  /** Real current count vs. plan limit -- projects.length is already the
   * real count (this hook only ever fetches workspace=code conversations),
   * codeAppLimit comes from config/limits.ts by tier. */
  codeAppLimit?: number;
  onLimitReached?: () => void;
}

/** Declared at module scope: a component defined inside the render body is
 * a new type on every render, which remounts it and drops its state. */
function Logo() {
  return <AIIcon size={28} />;
}

export const Sidebar = ({
  projects,
  activeProjectId,
  setActiveProject,
  userProfile,
  onLogout,
  onNewProject,
  collapsed,
  toggleSidebar,
  onDeleteProject,
  isFree,
  onOpenSettings,
  codeAppLimit,
  onLimitReached,
}: SidebarProps) => {
  const tNav = useTranslations("nav");
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
          <button
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "ml-auto relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:scale-105 hover:bg-accent/10 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            )}
          >
            <PanelLeft className="h-[18px] w-[18px]" />
          </button>
        </div>

        {!collapsed && (
          <>
            <div className="px-3 pt-3">
              {(() => {
                const atLimit = typeof codeAppLimit === "number" && projects.length >= codeAppLimit;
                return (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={atLimit ? onLimitReached : onNewProject}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                      atLimit
                        ? "border-accent/30 bg-accent/10 text-accent hover:bg-accent/15"
                        : "border-border bg-accent/5 text-foreground hover:bg-accent/10"
                    )}
                  >
                    <Plus className="h-4 w-4" /> {atLimit ? "Upgrade to create more" : "New Project"}
                  </motion.button>
                );
              })()}
              {typeof codeAppLimit === "number" && (
                <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
                  {projects.length} / {codeAppLimit} apps used
                </p>
              )}
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
                    onClick={() => setActiveProject(String(c.id))}
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
                            onDeleteProject(String(c.id));
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

        <SidebarWorkspaceLinks collapsed={collapsed} />

        {isFree && (
          <div className={cn("pb-2", collapsed ? "px-2" : "px-1")}>
            <SidebarUpgradeCard collapsed={collapsed} />
          </div>
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
                <LogOut className="w-3.5 h-3.5" /> {tNav("signOut")}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={onOpenSettings}
                aria-label={tNav("settings")}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:scale-105 hover:bg-accent/10 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                onClick={onLogout}
                aria-label={tNav("signOut")}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:scale-105 hover:bg-accent/10 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
};
