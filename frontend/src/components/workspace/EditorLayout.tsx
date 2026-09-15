"use client";

import dynamic from "next/dynamic";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import FileExplorer from "@/components/FileExplorer";   // your existing
import Toolbar from "./Toolbar";

const CodeEditor = dynamic(() => import("@/components/CodeEditor"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-gray-400">Loading editor...</div>,
});

const Preview = dynamic(() => import("@/components/Preview"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-gray-400">Loading preview...</div>,
});

const Terminal = dynamic(() => import("@/components/Terminal"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-gray-400">Loading terminal...</div>,
});

export default function EditorLayout({ codeContent = "" }: { codeContent?: string }) {
  const { files, currentFile, updateFileContent } = useWorkspaceStore();

  return (
    <div className="flex flex-col h-full">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        {/* Left: File Explorer */}
        <div className="w-64 border-r border-gray-700 p-2 overflow-y-auto">
          <FileExplorer />
        </div>
        {/* Center: Editor */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              filePath={currentFile}
              content={files.find((file) => file.path === currentFile)?.content || codeContent}
              onContentChange={(newContent) => currentFile && updateFileContent(currentFile, newContent)}
            />
          </div>
          {/* Bottom: Terminal */}
          <div className="h-40 border-t border-gray-700">
            <Terminal />
          </div>
        </div>
        {/* Right: Preview */}
        <div className="w-1/3 border-l border-gray-700 p-2">
          <Preview />
        </div>
      </div>
    </div>
  );
}