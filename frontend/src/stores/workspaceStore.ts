import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface FileNode {
  path: string;
  content: string;
  isFolder?: boolean;
  children?: FileNode[];
}

export interface Chat {
  id: string;
  title: string;
  messages: { role: "user" | "assistant"; content: string }[];
  projectId?: string;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  pinned: boolean;
  files: FileNode[];
  chats: string[]; // chat ids
  createdAt: number;
}

interface WorkspaceState {
  mode: "idle" | "editor" | "building" | "preview" | "fixing";
  projects: Project[];
  currentProjectId: string | null;
  files: FileNode[];
  currentFile: string | null;
  chats: Chat[];
  recentChats: Chat[];
  pinnedProjects: Project[];
  // actions
  getRecentChats: () => void;
  getPinnedProjects: () => void;
  setCurrentFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  createNewFile: (name: string) => void;
  deleteFile: (path: string) => void;
  renameFile: (oldPath: string, newPath: string) => void;
  createFolder: (name: string) => void;
  addChat: (chat: Chat) => void;
  setMode: (mode: WorkspaceState["mode"]) => void;
  terminalLogs: string[];
  buildStatus: string;
  // ... more actions
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      projects: [],
      mode: "idle",
      terminalLogs: [],
      buildStatus: "idle",
      currentProjectId: null,
      files: [],
      currentFile: null,
      chats: [],
      recentChats: [],
      pinnedProjects: [],

      getRecentChats: () => {
        const chats = get().chats;
        const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);
        set({ recentChats: sorted });
      },

      getPinnedProjects: () => {
        const pinned = get().projects.filter((p) => p.pinned);
        set({ pinnedProjects: pinned });
      },

      setCurrentFile: (path) => set({ currentFile: path }),

      updateFileContent: (path, content) => {
        set((state) => ({
          files: state.files.map((f) => (f.path === path ? { ...f, content } : f)),
        }));
      },

      createNewFile: (name) => {
        const path = name; // simplistic
        set((state) => ({
          files: [...state.files, { path, content: "", isFolder: false }],
        }));
      },

      deleteFile: (path) => {
        set((state) => ({
          files: state.files.filter((f) => f.path !== path),
        }));
      },

      renameFile: (oldPath, newPath) => {
        set((state) => ({
          files: state.files.map((f) =>
            f.path === oldPath ? { ...f, path: newPath } : f
          ),
        }));
      },

      createFolder: (name) => {
        const path = name + "/";
        set((state) => ({
          files: [...state.files, { path, content: "", isFolder: true }],
        }));
      },

      addChat: (chat) => {
        set((state) => ({
          chats: [...state.chats, chat],
        }));
      },
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "vatsa-workspace-storage",
    }
  )
);