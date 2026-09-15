// frontend/src/stores/app-store.ts
import { create } from 'zustand';
import { chat, User, Chat as ApiChat } from '@/services/chat';
import {
  loadWorkspace,
  persistWorkspace,
  makeChat,
  makeMessage,
  titleFromText,
  uid,
} from '@/utils/workspace';    // adjust import path
import type { Chat, Message } from '@/types/chat';

interface AppState {
  // User
  user: User | null;
  // Workspace state (mimics Workspace interface)
  conversations: Chat[];
  activeChatId: string | null;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  settings: any; // your settings type

  // UI state
  isLoading: boolean;
  error: string | null;

  // Derived getters
  chats: Chat[];
  currentChat: Chat | null;

  // Actions
  setUser: (user: User) => void;
  loadFromStorage: () => void;
  fetchChats: () => Promise<void>;           // now just loads from storage
  createChat: (title?: string) => Promise<Chat>;
  sendMessage: (chatId: string, query: string) => Promise<string>;
  deleteChat: (chatId: string) => Promise<void>;
  setCurrentChat: (chat: Chat) => void;
  updateChat: (chat: Chat) => void;          // helper to update & persist
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  conversations: [],
  activeChatId: null,
  sidebarCollapsed: false,
  sidebarWidth: 280,
  settings: {},
  isLoading: false,
  error: null,

  // Computed
  get chats() {
    return get().conversations.filter(c => !c.deletedAt);
  },
  get currentChat() {
    const { conversations, activeChatId } = get();
    return conversations.find(c => c.id === activeChatId) || null;
  },

  setUser: (user) => set({ user }),

  loadFromStorage: () => {
    const ws = loadWorkspace();
    set({
      conversations: ws.conversations,
      activeChatId: ws.activeChatId,
      sidebarCollapsed: ws.sidebarCollapsed,
      sidebarWidth: ws.sidebarWidth,
      settings: ws.settings,
    });
  },

  // This now just loads from storage (or you can also fetch from API if needed)
  fetchChats: async () => {
    set({ isLoading: true, error: null });
    try {
      // If you have a backend, you could fetch and merge, but here we use local storage
      get().loadFromStorage();
      set({ isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createChat: async (title = 'New conversation') => {
    const { user } = get();
    if (!user) throw new Error('User not authenticated');

    set({ isLoading: true, error: null });
    try {
      // Optionally call API to create chat on backend
      // For now, just create locally
      const newChat = makeChat({ title });
      set((state) => {
        const updated = [newChat, ...state.conversations];
        // Persist immediately
        const ws = loadWorkspace();
        ws.conversations = updated;
        ws.activeChatId = newChat.id;
        persistWorkspace(ws);
        return { conversations: updated, activeChatId: newChat.id, isLoading: false };
      });
      return newChat;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  sendMessage: async (chatId: string, query: string) => {
    const { user, conversations } = get();
    if (!user) throw new Error('User not authenticated');
    const chat = conversations.find(c => c.id === chatId);
    if (!chat) throw new Error('Chat not found');

    set({ isLoading: true, error: null });

    // Create user message
    const userMsg = makeMessage({ role: 'user', content: query });
    // Create placeholder assistant message
    const assistantMsg = makeMessage({ role: 'assistant', content: '', status: 'sending' });

    // Update chat with both messages (optimistic)
    const updatedChat = {
      ...chat,
      messages: [...chat.messages, userMsg, assistantMsg],
      updatedAt: Date.now(),
    };
    get().updateChat(updatedChat);

    try {
      // Call the API
      const data = await chat.get(query, user);
      const assistantReply = data.response || '';

      // Replace placeholder with actual reply
      const finalMessages = updatedChat.messages.map(m =>
        m.id === assistantMsg.id ? { ...m, content: assistantReply, status: 'done' } : m
      );
      const finalChat = { ...updatedChat, messages: finalMessages };
      get().updateChat(finalChat);

      // Auto‑title if this is the first user message
      if (chat.messages.length === 0 && chat.title === 'New conversation') {
        const newTitle = titleFromText(query);
        const titledChat = { ...finalChat, title: newTitle };
        get().updateChat(titledChat);
      }

      set({ isLoading: false });
      return assistantReply;
    } catch (err) {
      // Mark assistant message as error
      const errorMessages = updatedChat.messages.map(m =>
        m.id === assistantMsg.id ? { ...m, content: 'Error: ' + (err as Error).message, status: 'error' } : m
      );
      const errorChat = { ...updatedChat, messages: errorMessages };
      get().updateChat(errorChat);
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  deleteChat: async (chatId: string) => {
    set({ isLoading: true, error: null });
    try {
      // If you have a backend, call API delete first, then local
      // For now, soft delete locally
      set((state) => {
        const updated = state.conversations.map(c =>
          c.id === chatId ? { ...c, deletedAt: Date.now() } : c
        );
        const ws = loadWorkspace();
        ws.conversations = updated;
        if (ws.activeChatId === chatId) ws.activeChatId = null;
        persistWorkspace(ws);
        return { conversations: updated, activeChatId: ws.activeChatId, isLoading: false };
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  setCurrentChat: (chat: Chat) => {
    set((state) => {
      const ws = loadWorkspace();
      ws.activeChatId = chat.id;
      persistWorkspace(ws);
      return { activeChatId: chat.id };
    });
  },

  // Helper to update a chat and persist
  updateChat: (chat: Chat) => {
    set((state) => {
      const updated = state.conversations.map(c => c.id === chat.id ? chat : c);
      const ws = loadWorkspace();
      ws.conversations = updated;
      persistWorkspace(ws);
      return { conversations: updated };
    });
  },
}));