"use client";

import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import {
  X,
  ExternalLink,
  Download,
  FileText,
  CheckCircle,
  Clock,
  Globe,
  Copy,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  ChevronDown,
  Layers,
  Zap,
  Sparkles,
  GitBranch,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Plus,
  Minimize2,
  Maximize2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { Source, OrchestrationStep } from "@/types";
import { useState, useEffect, useCallback, useRef } from "react";

// -------------------------------------------------------------------
// Enhanced Source Card with Rich Info
// -------------------------------------------------------------------
function SourceCard({ source, onToggleBookmark, bookmarked }: { source: Source; onToggleBookmark: (id: string) => void; bookmarked: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 p-3 rounded-xl border transition-all duration-200 cursor-pointer",
        "border-border-subtle dark:border-border-dark hover:border-primary-300 dark:hover:border-primary-700",
        "hover:shadow-md dark:hover:shadow-primary-900/20 bg-white dark:bg-zinc-900/50",
        expanded && "border-primary-400 dark:border-primary-600 shadow-sm"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Favicon / Icon */}
        <div className="shrink-0 mt-0.5">
          {source.favicon ? (
            <img src={source.favicon} alt="" className="w-5 h-5 rounded" />
          ) : (
            <div className="w-5 h-5 rounded bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center">
              <Globe className="w-3 h-3 text-primary-600 dark:text-primary-300" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{source.domain}</span>
            {source.freshness && (
              <span className="flex items-center gap-0.5 text-xs text-zinc-400">
                <Clock className="w-3 h-3" />
                {source.freshness}
              </span>
            )}
            {source.visited && (
              <span className="flex items-center gap-0.5 text-xs text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">
                <CheckCircle className="w-3 h-3" />
                Visited
              </span>
            )}
            {source.confidence && (
              <span className="flex items-center gap-0.5 text-xs text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full">
                <Zap className="w-3 h-3" />
                {Math.round(source.confidence * 100)}%
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
            {source.title}
          </h4>
          <p className={cn(
            "text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 transition-all",
            expanded ? "line-clamp-none" : "line-clamp-2"
          )}>
            {source.snippet}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleBookmark(source.id); }}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            title={bookmarked ? "Remove bookmark" : "Bookmark"}
          >
            {bookmarked ? <BookmarkCheck className="w-4 h-4 text-primary-500" /> : <Bookmark className="w-4 h-4" />}
          </button>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            onClick={(e) => e.stopPropagation()}
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Expand indicator */}
      {!expanded && source.snippet && source.snippet.length > 120 && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          className="text-xs text-primary-500 hover:underline self-start"
        >
          Read more
        </button>
      )}
    </div>
  );
}

// -------------------------------------------------------------------
// Orchestration Step with Animated Timeline
// -------------------------------------------------------------------
function StepItem({ step, index }: { step: OrchestrationStep; index: number }) {
  const statusIcons = {
    done: <CheckCircle className="w-4 h-4 text-emerald-500" />,
    running: <RefreshCw className="w-4 h-4 text-primary-500 animate-spin" />,
    pending: <Clock className="w-4 h-4 text-zinc-400" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />,
  };

  return (
    <div className="relative flex items-start gap-3 p-3 rounded-xl border border-border-subtle dark:border-border-dark bg-white dark:bg-zinc-900/30 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all">
      {/* Timeline line */}
      {index > 0 && (
        <div className="absolute left-5 top-0 -translate-y-1/2 w-px h-4 bg-border-subtle dark:bg-border-dark" />
      )}
      <div className="shrink-0 mt-0.5">{statusIcons[step.status] || statusIcons.pending}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{step.icon} {step.label}</span>
          {step.duration && (
            <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{step.duration}</span>
          )}
        </div>
        {step.detail && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{step.detail}</p>}
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-medium capitalize",
              step.status === "done" && "text-emerald-500",
              step.status === "running" && "text-primary-500",
              step.status === "pending" && "text-zinc-400",
              step.status === "error" && "text-red-500"
            )}>
              {step.status}
            </span>
            {step.status === "running" && (
              <div className="flex-1 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            )}
            {step.status === "done" && (
              <div className="flex-1 h-1 bg-emerald-200 dark:bg-emerald-900/30 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: "100%" }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// Outline Section (Collapsible)
// -------------------------------------------------------------------
function OutlineSection({ response }: { response?: string }) {
  const [expanded, setExpanded] = useState(true);
  // Simple outline extraction: split by headings (##, ###) or numbered lists
  const generateOutline = (text: string) => {
    if (!text) return [];
    const lines = text.split("\n");
    const headings: { level: number; text: string }[] = [];
    lines.forEach((line) => {
      const match = line.match(/^(#{1,3})\s+(.+)/);
      if (match) {
        headings.push({ level: match[1].length, text: match[2] });
      }
    });
    return headings;
  };

  const outline = response ? generateOutline(response) : [];

  if (outline.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-400">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No outline available</p>
        <p className="text-xs">Response headings will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Outline ({outline.length})
      </button>
      {expanded && (
        <div className="space-y-1 pl-2 border-l-2 border-border-subtle dark:border-border-dark">
          {outline.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer"
              style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
            >
              <ChevronRight className="w-3 h-3 text-zinc-400" />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------
// Main RightPanel Component
// -------------------------------------------------------------------
export function RightPanel() {
  const {
    rightPanelOpen,
    setRightPanelOpen,
    rightPanelTab,
    setRightPanelTab,
    activeSources,
    orchestrationSteps,
    getActiveConversation,
  } = useAppStore();

  const [bookmarkedSources, setBookmarkedSources] = useState<Set<string>>(new Set());
  const [showMinimized, setShowMinimized] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortBy, setSortBy] = useState<"relevance" | "freshness" | "domain">("relevance");

  const activeConv = getActiveConversation();
  const lastResponse = activeConv?.messages?.filter(m => m.role === "assistant").pop()?.content || "";

  const toggleBookmark = useCallback((id: string) => {
    setBookmarkedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  // Keyboard shortcuts for tabs (Cmd+1,2,3)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "1") { setRightPanelTab("sources"); e.preventDefault(); }
      if (e.metaKey && e.key === "2") { setRightPanelTab("tools"); e.preventDefault(); }
      if (e.metaKey && e.key === "3") { setRightPanelTab("outline"); e.preventDefault(); }
      if (e.key === "Escape") { setRightPanelOpen(false); }
    };
    if (rightPanelOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [rightPanelOpen, setRightPanelTab, setRightPanelOpen]);

  if (!rightPanelOpen) return null;

  // Sort sources
  const sortedSources = [...activeSources].sort((a, b) => {
    if (sortBy === "relevance") return (b.confidence || 0) - (a.confidence || 0);
    if (sortBy === "freshness") return (a.freshness || "").localeCompare(b.freshness || "");
    return (a.domain || "").localeCompare(b.domain || "");
  });

  const tabConfig = [
    { id: "sources" as const, label: "Sources", icon: FileText, badge: activeSources.length },
    { id: "tools" as const, label: "Tools", icon: GitBranch, badge: orchestrationSteps.filter(s => s.status === "running" || s.status === "done").length },
    { id: "outline" as const, label: "Outline", icon: Layers, badge: 0 },
  ];

  return (
    <aside className="relative h-full border-l border-border-subtle dark:border-border-dark bg-white dark:bg-zinc-950 flex flex-col animate-slide-in-right w-[380px]">
      {/* Resize handle (visual only) */}
      <div className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-400 transition-colors z-10" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle dark:border-border-dark bg-gradient-to-r from-white to-zinc-50/50 dark:from-zinc-950 dark:to-zinc-900/50">
        <div className="flex items-center gap-1">
          {tabConfig.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRightPanelTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 relative",
                rightPanelTab === tab.id
                  ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-primary-500 text-white rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
          <span className="text-[10px] text-zinc-400 hidden md:inline ml-1">⌘1-3</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400"
            title={viewMode === "list" ? "Grid view" : "List view"}
          >
            {viewMode === "list" ? <Layers className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setRightPanelOpen(false)}
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {rightPanelTab === "sources" && (
          <div className="space-y-3">
            {/* Header actions */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                {activeSources.length} Sources
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSortBy(sortBy === "relevance" ? "freshness" : sortBy === "freshness" ? "domain" : "relevance")}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                >
                  <Filter className="w-3 h-3" />
                  {sortBy === "relevance" ? "Relevance" : sortBy === "freshness" ? "Freshness" : "Domain"}
                </button>
                <button
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 transition-colors"
                  onClick={() => {
                    // Export sources as CSV
                    const csv = activeSources.map(s => `${s.title},${s.domain},${s.url}`).join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "sources.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="w-3 h-3" />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Sources grid/list */}
            <div className={cn("gap-3", viewMode === "grid" ? "grid grid-cols-2" : "space-y-2")}>
              {sortedSources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  bookmarked={bookmarkedSources.has(source.id)}
                  onToggleBookmark={toggleBookmark}
                />
              ))}
            </div>

            {/* Empty state */}
            {activeSources.length === 0 && (
              <div className="text-center py-12 text-zinc-400">
                <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No sources yet</p>
                <p className="text-xs">Enable Web Search or ask a question to get sources</p>
                <div className="mt-4 flex justify-center gap-3">
                  <button className="px-3 py-1.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">Enable Web Search</button>
                </div>
              </div>
            )}
          </div>
        )}

        {rightPanelTab === "tools" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Orchestration Steps
              </span>
              <span className="text-xs text-zinc-400">
                {orchestrationSteps.filter(s => s.status === "done").length}/{orchestrationSteps.length} done
              </span>
            </div>
            {orchestrationSteps.length > 0 ? (
              <div className="space-y-2">
                {orchestrationSteps.map((step, idx) => (
                  <StepItem key={step.id} step={step} index={idx} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-zinc-400">
                <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No tools running</p>
                <p className="text-xs">AI will use tools as needed</p>
              </div>
            )}
          </div>
        )}

        {rightPanelTab === "outline" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Response Outline</span>
            </div>
            <OutlineSection response={lastResponse} />
          </div>
        )}
      </div>

      {/* Footer Quick Actions */}
      <div className="border-t border-border-subtle dark:border-border-dark p-3 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center justify-between text-xs text-zinc-500">
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
            <Copy className="w-3.5 h-3.5" /> Copy all
          </button>
          <button className="flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
            <Bookmark className="w-3.5 h-3.5" /> Cite
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className={cn(
              "inline-block w-2 h-2 rounded-full",
              orchestrationSteps.some(s => s.status === "running") ? "bg-primary-500 animate-pulse" : "bg-emerald-500"
            )} />
            {orchestrationSteps.some(s => s.status === "running") ? "Processing" : "Idle"}
          </span>
          <span className="text-zinc-300">|</span>
          <span>{activeSources.length} sources</span>
        </div>
      </div>
    </aside>
  );
}