// Conversation CRUD slice
import type { Conversation, Message } from "@/types";
import type { StateCreator } from "zustand";
import { chat } from "@/services/chat";
import { loadWorkspace, makeChat, makeMessage, titleFromText, uid } from "@/utils/workspace";

type ExtendedConversation = Conversation & { favorite?: boolean; isPrivate?: boolean; };

export interface ConversationSlice {
  conversations: ExtendedConversation[];
  activeConversationId: string | null;
  memories: { id: string; text: string; createdAt: string }[];
  get chats(): ExtendedConversation[];
  get currentChat(): ExtendedConversation | undefined;
  createConversation: (title?: string) => Promise<ExtendedConversation>;
  createLocalConversation: (title?: string) => ExtendedConversation;
  setActiveConversation: (id: string | null) => void;
  deleteConversation: (id: string) => Promise<void>;
  clearAllConversations: () => void;
  renameConversation: (id: string, title: string) => Promise<void>;
  togglePinConversation: (id: string) => Promise<void>;
  pinConversation: (id: string) => void;
  unpinConversation: (id: string) => void;
  toggleFavorite: (id: string) => void;
  archiveConversation: (id: string) => Promise<void>;
  duplicateConversation: (id: string) => Promise<void>;
  sendMessage: (conversationId: string | null, content: string) => Promise<void>;
  addMessage: (conversationId: string, message: Message) => Promise<void>;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  getActiveConversation: () => ExtendedConversation | undefined;
  getConversationMessages: (id: string) => Message[];
  exportConversation: (id: string, format?: "json" | "txt" | "markdown") => void;
  shareConversation: (id: string) => void;
  fetchAllData: (token?: string) => Promise<void>;
  addMemory: (text: string) => void;
  deleteMemory: (id: string) => void;
}
