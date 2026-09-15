import { useSyncExternalStore } from "react";
import type { Chat, Folder, Message, Settings, Workspace } from "../types/chat";
import {
  loadWorkspace,
  makeChat,
  persistWorkspace,
  uid,
} from "./storage";

type Listener = () => void;

let state: Workspace = loadWorkspace();
const listeners = new Set<Listener>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (state.settings.saveHistory) persistWorkspace(state);
  }, 500);
}

function emit() {
  listeners.forEach((l) => l());
}

export function setState(updater: (prev: Workspace) => Workspace) {
  state = updater(state);
  emit();
  scheduleSave();
}

export function getState() {
  return state;
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useWorkspace<T>(selector: (ws: Workspace) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export function flushSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  if (state.settings.saveHistory) persistWorkspace(state);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushSave);
  window.addEventListener("storage", (e) => {
    if (e.key === "vatsa_workspace" && e.newValue) {
      state = loadWorkspace();
      emit();
    }
  });
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function mapChat(id: string, fn: (c: Chat) => Chat) {
  setState((s) => ({
    ...s,
    conversations: s.conversations.map((c) => (c.id === id ? fn(c) : c)),
  }));
}

export const actions = {
  /* ---------- chats ---------- */
  newChat(): string {
    // reuse the current chat if it is still untouched (no messages, no draft)
    const current = state.conversations.find(
      (c) => c.id === state.activeChatId && !c.deletedAt && !c.archived,
    );
    if (current && current.messages.length === 0 && !current.draft.trim()) {
      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === current.id ? { ...c, lastOpened: Date.now() } : c,
        ),
      }));
      return current.id;
    }
    const chat = makeChat({
      model: state.settings.defaultModel,
      temperature: state.settings.temperature,
      systemPrompt: state.settings.systemPrompt,
    });
    setState((s) => ({
      ...s,
      conversations: [chat, ...s.conversations],
      activeChatId: chat.id,
    }));
    return chat.id;
  },

  ensureActiveChat(): string {
    const active = state.conversations.find(
      (c) => c.id === state.activeChatId && !c.deletedAt && !c.archived,
    );
    if (active) return active.id;
    return actions.newChat();
  },

  openChat(id: string) {
    setState((s) => ({
      ...s,
      activeChatId: id,
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, lastOpened: Date.now() } : c,
      ),
    }));
  },

  setActive(id: string | null) {
    setState((s) => ({ ...s, activeChatId: id }));
  },

  rename(id: string, title: string) {
    const t = title.trim();
    mapChat(id, (c) => ({
      ...c,
      title: t || c.title,
      updatedAt: Date.now(),
    }));
  },

  togglePin(id: string) {
    mapChat(id, (c) => ({ ...c, pinned: !c.pinned }));
  },

  toggleFavorite(id: string) {
    mapChat(id, (c) => ({ ...c, favorite: !c.favorite }));
  },

  toggleArchive(id: string) {
    mapChat(id, (c) => ({ ...c, archived: !c.archived }));
    if (state.activeChatId === id) setState((s) => ({ ...s, activeChatId: null }));
  },

  softDelete(id: string) {
    mapChat(id, (c) => ({ ...c, deletedAt: Date.now() }));
    if (state.activeChatId === id) {
      const next = state.conversations.find(
        (c) => c.id !== id && !c.deletedAt && !c.archived,
      );
      setState((s) => ({ ...s, activeChatId: next ? next.id : null }));
    }
  },

  restore(id: string) {
    mapChat(id, (c) => ({ ...c, deletedAt: null }));
  },

  purge(id: string) {
    setState((s) => ({
      ...s,
      conversations: s.conversations.filter((c) => c.id !== id),
      activeChatId: s.activeChatId === id ? null : s.activeChatId,
    }));
  },

  purgeAllDeleted() {
    setState((s) => ({
      ...s,
      conversations: s.conversations.filter((c) => !c.deletedAt),
    }));
  },

  clearAllChats() {
    setState((s) => ({ ...s, conversations: [], activeChatId: null }));
  },

  setDraft(id: string, draft: string) {
    mapChat(id, (c) => (c.draft === draft ? c : { ...c, draft }));
  },

  setScroll(id: string, y: number) {
    const c = state.conversations.find((x) => x.id === id);
    if (!c || Math.abs(c.scrollPosition - y) < 24) return;
    mapChat(id, (x) => ({ ...x, scrollPosition: y }));
  },

  setChatModel(id: string, model: string) {
    mapChat(id, (c) => ({ ...c, model }));
  },

  /* ---------- messages ---------- */
  addMessage(chatId: string, message: Message) {
    mapChat(chatId, (c) => ({
      ...c,
      messages: [...c.messages, message],
      updatedAt: Date.now(),
    }));
  },

  updateMessage(chatId: string, msgId: string, patch: Partial<Message>) {
    mapChat(chatId, (c) => ({
      ...c,
      messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
      updatedAt: Date.now(),
    }));
  },

  deleteMessage(chatId: string, msgId: string) {
    mapChat(chatId, (c) => ({
      ...c,
      messages: c.messages.filter((m) => m.id !== msgId),
      updatedAt: Date.now(),
    }));
  },

  truncateFrom(chatId: string, msgId: string) {
    mapChat(chatId, (c) => {
      const i = c.messages.findIndex((m) => m.id === msgId);
      return i < 0 ? c : { ...c, messages: c.messages.slice(0, i) };
    });
  },

  /* ---------- folders ---------- */
  createFolder(name: string): Folder {
    const f: Folder = { id: uid("fld"), name, createdAt: Date.now() };
    setState((s) => ({ ...s, folders: [...s.folders, f] }));
    return f;
  },
  renameFolder(id: string, name: string) {
    setState((s) => ({
      ...s,
      folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    }));
  },
  deleteFolder(id: string) {
    setState((s) => ({
      ...s,
      folders: s.folders.filter((f) => f.id !== id),
      conversations: s.conversations.map((c) =>
        c.folderId === id ? { ...c, folderId: null } : c,
      ),
    }));
  },
  moveToFolder(chatId: string, folderId: string | null) {
    mapChat(chatId, (c) => ({ ...c, folderId }));
  },

  /* ---------- ui ---------- */
  toggleSidebar() {
    setState((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }));
  },
  setSidebarCollapsed(v: boolean) {
    setState((s) => ({ ...s, sidebarCollapsed: v }));
  },
  setSidebarWidth(w: number) {
    setState((s) => ({ ...s, sidebarWidth: w }));
  },

  /* ---------- settings ---------- */
  setSettings(patch: Partial<Settings>) {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },

  addMemory(text: string) {
    setState((s) => ({
      ...s,
      settings: {
        ...s.settings,
        memories: [
          { id: uid("mem"), text, createdAt: Date.now() },
          ...s.settings.memories,
        ],
      },
    }));
  },
  removeMemory(id: string) {
    setState((s) => ({
      ...s,
      settings: {
        ...s.settings,
        memories: s.settings.memories.filter((m) => m.id !== id),
      },
    }));
  },

  /* ---------- search ---------- */
  pushSearch(q: string) {
    const term = q.trim();
    if (term.length < 2) return;
    setState((s) => ({
      ...s,
      recentSearches: [term, ...s.recentSearches.filter((t) => t !== term)].slice(
        0,
        8,
      ),
    }));
  },
  clearSearches() {
    setState((s) => ({ ...s, recentSearches: [] }));
  },

  importWorkspace(ws: Workspace) {
    state = ws;
    emit();
    scheduleSave();
  },
};
