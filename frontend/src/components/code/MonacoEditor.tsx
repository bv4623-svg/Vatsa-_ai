"use client";

import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full animate-pulse flex-col bg-muted/20">
      <div className="h-8 border-b border-border/20 bg-muted/10" />
      <div className="flex-1 space-y-2 p-4">
        <div className="h-4 w-3/4 rounded bg-muted/30" />
        <div className="h-4 w-1/2 rounded bg-muted/30" />
        <div className="h-4 w-5/6 rounded bg-muted/30" />
        <div className="h-4 w-2/3 rounded bg-muted/30" />
      </div>
    </div>
  ),
});

export { MonacoEditor };
