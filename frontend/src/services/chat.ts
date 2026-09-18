// services/chat.ts
import api from '@/lib/axios';
import { API_BASE } from "@/config/api";

export interface User {
  id?: string | number;
  email?: string;
  name?: string;
  full_name?: string;
  // Free/pro/business tier gating (see backend app/services/feature_access.py).
  tier?: "free" | "pro" | "business";
  usage?: Record<string, { used: number; limit: number }>;
}

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
  workspace?: string;
}

export interface SendMessageResponse {
  chat_id: number;
  user_message: string;
  assistant_reply: string;
  history_count: number;
  project_created: boolean;
  project_id?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  status?: "sending" | "streaming" | "done" | "error" | "stopped";
  edited?: boolean;
  bookmarked?: boolean;
  attachments?: any[];
  model?: string;
}

export const chat = {
  /**
   * Fetch all conversations for the authenticated user.
   * GET /api/conversations?workspace=chat|code
   */
  list: async (workspace: "chat" | "code" = "chat"): Promise<Conversation[]> => {
    const res = await api.get(`/api/conversations?workspace=${workspace}`);
    return res.data;
  },

  /**
   * Create a new conversation with a given title.
   * POST /api/conversations
   */
  create: async (title: string, workspace: "chat" | "code" = "chat"): Promise<Conversation> => {
    const res = await api.post('/api/conversations', { title, workspace });
    return res.data;
  },

  /**
   * Delete a conversation by its ID.
   * DELETE /api/conversations/{id}
   */
  delete: async (convId: number | string): Promise<void> => {
    await api.delete(`/api/conversations/${convId}`);
  },

  rename: async (convId: number | string, title: string): Promise<void> => {
    await api.patch(`/api/conversations/${convId}`, { title });
  },

  pin: async (convId: number | string, pinned: boolean): Promise<void> => {
    if (pinned) {
      await api.post(`/api/conversations/${convId}/pin`);
    } else {
      await api.delete(`/api/conversations/${convId}/pin`);
    }
  },

  archive: async (convId: number | string): Promise<void> => {
    await api.post(`/api/conversations/${convId}/archive`);
  },

  /**
   * Send a message to the chat API (persistent + memory aware).
   * POST /api/chat/send
   */
  sendMessage: async (
    message: string,
    chatId?: number | string,
    createProject: boolean = false
  ): Promise<SendMessageResponse> => {
    const res = await api.post('/api/chat/send', {
      message,
      chat_id: chatId,
      create_project: createProject,
    });
    return res.data;
  },

  /**
   * Streaming chat endpoint
   * POST /api/chat
   */
  streamMessage: async (
    message: string,
    conversationId: string,
    model: string,
    workspace: "chat" | "code",
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<{ response: string; files?: any[] }> => {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream, application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        message,
        model,
        conversation_id: conversationId,
        workspace,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      let msg = "Failed to get response from AI";
      try {
        const err = await response.json();
        msg = err.message || err.detail || msg;
      } catch {}
      throw new Error(msg);
    }

    const contentType = response.headers.get("content-type") || "";
    let text = "";

    if (contentType.includes("text/event-stream") && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload);
            if (typeof evt === "string") text += evt;
            else if (evt.delta) text += evt.delta;
            else if (evt.token) text += evt.token;
            else if (evt.content) text += evt.content;
            else if (evt.response) text += evt.response;
            onChunk(text);
          } catch {
            text += payload;
            onChunk(text);
          }
        }
      }
    } else {
      const data = await response.json();
      text = data.response || data.message || JSON.stringify(data);
    }

    return { response: text };
  },

  get: async (message: string): Promise<{ response?: string }> => {
    const res = await api.post('/api/chat', { message });
    return res.data;
  },
};

export async function createConversation(text: string, workspace: "chat" | "code" = "chat"): Promise<Conversation> {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('user');
    if (!stored) throw new Error('Not authenticated – please login');
  }
  return chat.create(text, workspace);
}

export default chat;
