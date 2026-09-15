"use client";

import { useState } from "react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import {
  Folder,
  File,
  FileCode,
  FileJson,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";

const getFileIcon = (name: string) => {
  const ext = name.split(".").pop() || "";
  switch (ext) {
    case "js":
    case "ts":
    case "jsx":
    case "tsx":
      return FileCode;
    case "json":
      return FileJson;
    case "md":
      return File;
    default:
      return FileText;
  }
};

export default function FileExplorer() {
  const { files, currentFile, setCurrentFile, createNewFile, deleteFile, createFolder } =
    useWorkspaceStore();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (path: string) => {
    const newSet = new Set(expandedFolders);
    if (newSet.has(path)) newSet.delete(path);
    else newSet.add(path);
    setExpandedFolders(newSet);
  };

  const root: { [key: string]: any } = {};
  files.forEach((file) => {
    const parts = file.path.split("/");
    let current = root;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        current[part] = file;
      } else {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
    });
  });

  const renderTree = (node: Record<string, any>, path: string = "") => {
    const entries = Object.entries(node);
    return (
      <ul className="space-y-0.5">
        {entries.map(([name, value]) => {
          const isFile = value && typeof value === "object" && "content" in value;
          const fullPath = path ? `${path}/${name}` : name;
          const isExpanded = expandedFolders.has(fullPath);
          const Icon = isFile ? getFileIcon(name) : Folder;
          const isActive = currentFile === fullPath;
          return (
            <li key={fullPath}>
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer hover:bg-white/5 ${
                  isActive ? "bg-blue-600/20 text-blue-400" : "text-gray-300"
                }`}
                onClick={() => {
                  if (isFile) setCurrentFile(fullPath);
                  else toggleFolder(fullPath);
                }}
              >
                <Icon size={16} className={isFile ? "text-blue-400" : "text-yellow-500"} />
                <span className="text-sm flex-1 truncate">{name}</span>
                {isFile && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFile(fullPath);
                    }}
                    className="opacity-0 hover:opacity-100 transition p-0.5 rounded hover:bg-white/10"
                  >
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                )}
              </div>
              {!isFile && isExpanded && renderTree(value, fullPath)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-400">EXPLORER</span>
        <div className="flex items-center gap-1">
          <button onClick={() => createNewFile("NewFile.txt")} className="p-1 rounded hover:bg-white/10">
            <Plus size={14} />
          </button>
          <button onClick={() => createFolder("NewFolder")} className="p-1 rounded hover:bg-white/10">
            <Folder size={14} />
          </button>
        </div>
      </div>
      {renderTree(root)}
    </div>
  );
}