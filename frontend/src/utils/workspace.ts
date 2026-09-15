// src/utils/workspace.ts

export type FocusMode = 'general' | 'academic' | 'creative' | 'technical';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  focusMode: FocusMode;
}

export interface Workspace {
  conversations: Conversation[];
  activeConversationId: string | null;
}

// 🔹 Unique ID generate करने के लिए
export const uid = (_prefix?: string): string => {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// 🔹 नया Message बनाने के लिए
export const makeMessage = (roleOrMessage: 'user' | 'assistant' | { role: 'user' | 'assistant'; content: string; status?: string }, maybeContent?: string): Message => {
  const role = typeof roleOrMessage === 'string' ? roleOrMessage : roleOrMessage.role;
  const content = typeof roleOrMessage === 'string' ? maybeContent || '' : roleOrMessage.content;
  return {
    id: uid(),
    role,
    content,
    timestamp: Date.now(),
  };
};

// 🔹 नई Chat/Conversation बनाने के लिए
export const makeChat = (conversation?: Partial<Conversation>): Conversation => {
  return {
    id: uid(),
    title: conversation?.title || 'New Chat',
    messages: conversation?.messages || [],
    createdAt: conversation?.createdAt || Date.now(),
    updatedAt: conversation?.updatedAt || Date.now(),
    focusMode: conversation?.focusMode || 'general',
  };
};

// 🔹 पहले message से Title generate करने के लिए
export const titleFromText = (text: string): string => {
  if (!text) return 'New Chat';
  const words = text.split(' ');
  if (words.length <= 5) return text;
  return words.slice(0, 5).join(' ') + '...';
};

// 🔹 localStorage से Workspace load करने के लिए
export const loadWorkspace = (): Workspace => {
  try {
    const stored = localStorage.getItem('vatsa-workspace');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load workspace', e);
  }
  // Default workspace (agar kuch stored nahi hai)
  return {
    conversations: [],
    activeConversationId: null,
  };
};

// 🔹 Workspace को localStorage में save करने के लिए
export const persistWorkspace = (workspace: Workspace): void => {
  try {
    localStorage.setItem('vatsa-workspace', JSON.stringify(workspace));
  } catch (e) {
    console.error('Failed to save workspace', e);
  }
};