// services/chat.ts
import api from '@/lib/axios';

export interface User {
  id?: string | number;
  email?: string;
  name?: string;
  full_name?: string;
}

export type Chat = Conversation;

// ---------- Types ----------
export interface Conversation {
  id: number | string;
  title: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  model?: any;
  focusMode?: any;
  webSearchEnabled?: boolean;
  pinned?: boolean;
  favorite?: boolean;
  messages?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SendMessageResponse {
  chat_id: number;
  user_message: string;
  assistant_reply: string;
  history_count: number;
  project_created: boolean;
  project_id?: number;
}

// ---------- Chat Service ----------
export const chat = {
  /**
   * Fetch all conversations for the authenticated user.
   * GET /api/chat/chats
   */
  list: async (_user?: User): Promise<Conversation[]> => {
    const res = await api.get('/api/chat/chats');
    return res.data;
  },

  /**
   * Create a new conversation with a given title.
   * POST /api/chat/chats
   */
  create: async (title: string, _user?: User): Promise<Conversation> => {
    const res = await api.post('/api/chat/chats', { title });
    return res.data;
  },

  /**
   * Delete a conversation by its ID.
   * DELETE /api/chat/chats/{id}
   */
  delete: async (convId: number | string, _user?: User): Promise<void> => {
    await api.delete(`/api/chat/chats/${convId}`);
  },

  rename: async (convId: number | string, title: string, _user?: User): Promise<void> => {
    await api.patch(`/api/chat/chats/${convId}`, { title });
  },

  pin: async (_convId: number | string, _pinned: boolean, _user?: User): Promise<void> => {},
  archive: async (_convId: number | string, _user?: User): Promise<void> => {},
  addMessage: async (_convId: number | string, _message: unknown, _user?: User): Promise<void> => {},

  /**
   * Send a message to the chat API (persistent + memory aware).
   * POST /api/chat/send
   *
   * @param message - the user's message
   * @param chatId - optional existing chat ID; if omitted, a new chat is created
   * @param createProject - if true, auto‑create a project from code blocks in the reply
   */
  sendMessage: async (
    message: string,
    chatId?: number,
    createProject: boolean = false
  ): Promise<SendMessageResponse> => {
    const res = await api.post('/api/chat/send', {
      message,
      chat_id: chatId,
      create_project: createProject,
    });
    return res.data;
  },

  get: async (message: string, _user?: User): Promise<{ response?: string }> => {
    const res = await api.post('/api/chat', { message });
    return res.data;
  },
};

// ---------- Convenience wrapper (for use in ChatInput) ----------
export async function createConversation(text: string): Promise<Conversation> {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('user');
    if (!stored) throw new Error('Not authenticated – please login');
  }
  return chat.create(text);
}

export default chat;