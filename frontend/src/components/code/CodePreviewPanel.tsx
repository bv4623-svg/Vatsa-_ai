"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  Monitor, Tablet, Smartphone, RefreshCw, ExternalLink,
  Copy, Download, Code, FolderOpen, File as FileIcon, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MonacoEditor } from "./MonacoEditor";
import type { ProjectFile } from "@/types/code";

const FREE_PREVIEW_SECONDS = 30;

interface CodePreviewPanelProps {
  codeContent: string;
  setCodeContent: (content: string) => void;
  previewMode: "preview" | "code";
  setPreviewMode: (mode: "preview" | "code") => void;
  theme: "dark" | "light" | "system";
  files: ProjectFile[];
  setFiles: (files: ProjectFile[]) => void;
  activeFile: string;
  setActiveFile: (file: string) => void;
  notify: (msg: string, kind?: "info" | "success" | "error") => void;
  isFree?: boolean;
  onUpgradeClick?: () => void;
}

export const CodePreviewPanel = ({
  codeContent,
  setCodeContent,
  previewMode,
  setPreviewMode,
  theme,
  files,
  setFiles,
  activeFile,
  setActiveFile,
  notify,
  isFree = false,
  onUpgradeClick,
}: CodePreviewPanelProps) => {
  const [key, setKey] = useState(0);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [previewBlurred, setPreviewBlurred] = useState(false);

  // Free tier: the live preview blurs after a short window so the code
  // panel stays useful (they can still read/edit code) but the polished
  // rendered result nudges toward upgrading.
  useEffect(() => {
    if (!isFree || !codeContent) {
      setPreviewBlurred(false);
      return;
    }
    setPreviewBlurred(false);
    const t = setTimeout(() => setPreviewBlurred(true), FREE_PREVIEW_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [isFree, codeContent]);

  const handleDownloadZip = useCallback(async () => {
    try {
      const zip = new JSZip();
      files.forEach((f) => zip.file(f.name, f.content));
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, "vatsa-project.zip");
      notify("ZIP downloaded", "success");
    } catch {
      files.forEach((f) => {
        const blob = new Blob([f.content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = f.name;
        a.click();
        URL.revokeObjectURL(url);
      });
      notify("Downloaded files individually", "info");
    }
  }, [files, notify]);

  const handleOpen = useCallback(() => {
    if (!codeContent) return;
    const blob = new Blob([codeContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, [codeContent]);

  const handleCopyAll = useCallback(() => {
    const current = files.find((f) => f.name === activeFile);
    if (current) {
      navigator.clipboard.writeText(current.content);
      notify("File copied", "success");
    }
  }, [files, activeFile, notify]);

  const deviceWidth =
    device === "desktop"
      ? "100%"
      : device === "tablet"
      ? "768px"
      : "375px";

  const hasCode = files.some((f) => f.content.trim().length > 0);
  const displayContent =
    codeContent ||
    "<!doctype html><html><body style='font-family:system-ui;padding:24px;color:#888;background:#0a0a0a;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;'>Waiting for AI to generate code…</body></html>";

  return (
    <div className="flex h-full flex-col bg-background/40 backdrop-blur-sm">
      <div className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-border/40 px-3">
        <span className="mr-2 text-xs font-medium text-muted-foreground/60">
          {previewMode === "preview" ? "Preview" : "Code"}
        </span>
        <button
          onClick={() => setPreviewMode("preview")}
          aria-label="Preview"
          className={cn(
            "rounded px-2 py-1 text-xs transition-all",
            previewMode === "preview"
              ? "bg-accent/20 text-foreground"
              : "text-muted-foreground/40 hover:bg-accent/10 hover:text-foreground"
          )}
        >
          <Monitor className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setPreviewMode("code")}
          aria-label="Code"
          className={cn(
            "rounded px-2 py-1 text-xs transition-all",
            previewMode === "code"
              ? "bg-accent/20 text-foreground"
              : "text-muted-foreground/40 hover:bg-accent/10 hover:text-foreground"
          )}
        >
          <Code className="h-3.5 w-3.5" />
        </button>

        <div className="mx-1 h-5 w-px bg-border/40" />
        <button
          onClick={() => setDevice("desktop")}
          aria-label="Desktop"
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:scale-105 hover:bg-accent/10 hover:text-foreground",
            device === "desktop" && "bg-accent/10 text-foreground"
          )}
        >
          <Monitor className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setDevice("tablet")}
          aria-label="Tablet"
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:scale-105 hover:bg-accent/10 hover:text-foreground",
            device === "tablet" && "bg-accent/10 text-foreground"
          )}
        >
          <Tablet className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setDevice("mobile")}
          aria-label="Mobile"
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:scale-105 hover:bg-accent/10 hover:text-foreground",
            device === "mobile" && "bg-accent/10 text-foreground"
          )}
        >
          <Smartphone className="h-3.5 w-3.5" />
        </button>

        <div className="mx-1 h-5 w-px bg-border/40" />
        <button
          onClick={() => setKey((k) => k + 1)}
          aria-label="Refresh"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:scale-105 hover:bg-accent/10 hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleOpen}
          disabled={!hasCode}
          aria-label="Open in new tab"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:scale-105 hover:bg-accent/10 hover:text-foreground disabled:opacity-40"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleCopyAll}
          disabled={!hasCode}
          aria-label="Copy active file"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:scale-105 hover:bg-accent/10 hover:text-foreground disabled:opacity-40"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={handleDownloadZip}
          disabled={!hasCode}
          aria-label="Download ZIP"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:scale-105 hover:bg-accent/10 hover:text-foreground disabled:opacity-40 ml-auto"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-background/20 p-2">
        {previewMode === "preview" ? (
          <div className="flex h-full w-full items-center justify-center">
            <div
              className="h-full w-full overflow-hidden rounded-xl border border-border/40 bg-card/80 shadow-2xl"
              style={{ maxWidth: deviceWidth, margin: "0 auto" }}
            >
              <div className="flex h-7 items-center gap-2 border-b border-border/40 bg-muted/20 px-3">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <span className="ml-2 text-[10px] text-muted-foreground/40">
                  preview.local
                </span>
              </div>
              <div className="relative h-[calc(100%-28px)] overflow-auto bg-white">
                <iframe
                  key={key}
                  srcDoc={displayContent}
                  sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups"
                  className={cn("h-full w-full border-0 transition-all", previewBlurred && "blur-md")}
                  title="Live Preview"
                />
                {previewBlurred && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-[1px]">
                    <Lock className="h-6 w-6 text-white/80" />
                    <p className="text-sm font-medium text-white">Live preview paused</p>
                    <button
                      onClick={onUpgradeClick}
                      className="rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-1.5 text-xs font-medium text-white hover:opacity-90"
                    >
                      Upgrade to keep previewing
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full gap-2">
            <div className="h-full w-48 overflow-y-auto border-r border-border/40 bg-muted/10 p-2">
              <div className="mb-2 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                <FolderOpen className="h-3 w-3" /> Files
                <span className="ml-auto rounded bg-accent/10 px-1.5 py-0.5 text-[9px] text-accent">
                  {files.length}
                </span>
              </div>
              {files.map((f) => (
                <button
                  key={f.name}
                  onClick={() => setActiveFile(f.name)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-all",
                    activeFile === f.name
                      ? "bg-accent/20 text-foreground"
                      : "text-muted-foreground/60 hover:bg-accent/10 hover:text-foreground"
                  )}
                >
                  <FileIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>
            <div className="h-full flex-1 overflow-hidden rounded-lg border border-border/40 bg-black/40">
              <MonacoEditor
                value={
                  files.find((f) => f.name === activeFile)?.content || ""
                }
                onChange={(value) => {
                  const newFiles = files.map((f) =>
                    f.name === activeFile
                      ? { ...f, content: value || "" }
                      : f
                  );
                  setFiles(newFiles);
                  if (activeFile === "index.html") {
                    setCodeContent(value || "");
                  }
                }}
                language={
                  files.find((f) => f.name === activeFile)?.language ||
                  (() => {
                    const ext = activeFile.split(".").pop()?.toLowerCase() || "";
                    const map: Record<string, string> = {
                      ts: "typescript", tsx: "typescript", js: "javascript",
                      jsx: "javascript", html: "html", css: "css", json: "json",
                      md: "markdown", py: "python", rs: "rust", go: "go",
                      java: "java", sql: "sql", sh: "shell", yml: "yaml", yaml: "yaml",
                    };
                    return map[ext] || "plaintext";
                  })()
                }
                theme={theme === "dark" ? "vs-dark" : "light"}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  automaticLayout: true,
                  wordWrap: "on",
                  lineNumbers: "on",
                  folding: true,
                  renderWhitespace: "selection",
                  tabSize: 2,
                }}
                className="h-full w-full"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
