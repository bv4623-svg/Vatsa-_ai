"use client";

import Editor from "@monaco-editor/react";

interface CodeEditorProps {
  filePath: string | null;
  content: string;
  onContentChange: (content: string) => void;
}

export default function CodeEditor({ filePath, content, onContentChange }: CodeEditorProps) {
  return (
    <Editor
      height="100%"
      theme="vs-dark"
      path={filePath ?? "untitled.txt"}
      value={content}
      onChange={(value) => onContentChange(value ?? "")}
      options={{ minimap: { enabled: false }, automaticLayout: true, padding: { top: 12 } }}
    />
  );
}
