import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { useRouter } from "next/navigation";
import type { Message, Conversation } from "@/types";
import { API_BASE } from "@/lib/home/constants";
import { normalizeConv, dedupeConversations } from "@/lib/home/conversation";

interface UseHomeConversationsParams {
  router: ReturnType<typeof useRouter>;
  setUser: (user: any) => void;
  setDraftMessage: (draft: string) => void;
  setErrorState: (err: { message: string; stack?: string } | null) => void;
}

/**
 * Owns the Chat page's conversation list: loading the user's profile +
 * conversations on mount, and every conversation-level CRUD action
 * (create/delete/rename/pin/favorite/duplicate/archive/clear/export).
 * Message-sending itself lives in useHomeChat.
 */
export function useHomeConversations({ router, setUser, setDraftMessage, setErrorState }: UseHomeConversationsParams) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const creatingChatRef = useRef<Promise<string | null> | null>(null);

  const activeConv = useMemo(() => {
    if (!Array.isArray(conversations)) return null;
    return conversations.find(c => String(c.id) === String(activeConversationId)) ?? null;
  }, [conversations, activeConversationId]);

  const messages = useMemo(() => activeConv?.messages || [], [activeConv]);

  const updateConversation = useCallback((id: string, updater: (conv: Conversation) => Conversation) => {
    setConversations(prev => {
      const updated = prev.map(c => String(c.id) === String(id) ? updater(c) : c);
      return dedupeConversations(updated);
    });
  }, []);

  const addMessageToConversation = useCallback((convId: string, message: Message) => {
    updateConversation(convId, (conv) => ({
      ...conv,
      messages: [...(conv.messages || []), message],
      updatedAt: new Date().toISOString(),
    }));
  }, [updateConversation]);

  const fetchProfileAndChats = useCallback(async (token: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const profileRes = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!profileRes.ok) {
        if (profileRes.status === 401) throw new Error("Unauthorized");
        throw new Error(`Profile fetch failed (${profileRes.status})`);
      }
      const profileData = await profileRes.json();
      setUser(profileData?.user ?? profileData);

      const convRes = await fetch(`${API_BASE}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!convRes.ok) throw new Error("Failed to fetch conversations");
      const raw = await convRes.json();
      const arr = Array.isArray(raw) ? raw : (raw?.conversations ?? raw?.data ?? []);
      const uniqueConvs = dedupeConversations(arr.map(normalizeConv));
      setConversations(uniqueConvs);

      setActiveConversationId(prev => prev ?? (uniqueConvs[0] ? String(uniqueConvs[0].id) : null));
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.message === "Unauthorized") {
        localStorage.removeItem("access_token");
        router.push("/login");
      } else {
        setErrorState({ message: error.message || "Failed to load profile" });
      }
    } finally {
      setLoading(false);
    }
  }, [setUser, router, setErrorState]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    fetchProfileAndChats(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRenameChat = useCallback(async (id: string, title: string) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title }),
      });
      updateConversation(id, (conv) => ({ ...conv, title }));
    } catch (error: any) {
      setErrorState({ message: error.message || "Failed to rename chat" });
    }
  }, [updateConversation, setErrorState]);

  const handleNewChat = useCallback(async (onCreated?: () => void): Promise<string | null> => {
    if (creatingChatRef.current) return creatingChatRef.current;

    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return null; }

    const task = (async (): Promise<string | null> => {
      try {
        const response = await fetch(`${API_BASE}/api/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: "New Chat" }),
        });
        const text = await response.text();
        if (!response.ok) throw new Error(text || `Failed (${response.status})`);

        let raw: any = {};
        try { raw = text ? JSON.parse(text) : {}; } catch { raw = {}; }
        const rawConv = raw?.conversation ?? raw?.data ?? raw;
        if (!rawConv || (rawConv.id ?? rawConv.conversation_id) == null) {
          throw new Error("Backend did not return valid conversation id");
        }
        const newConv = normalizeConv(rawConv);
        setConversations(prev => dedupeConversations([newConv, ...prev]));
        setActiveConversationId(String(newConv.id));
        setDraftMessage("");
        onCreated?.();
        return String(newConv.id);
      } catch (error: any) {
        setErrorState({ message: error.message || "Could not create new chat" });
        return null;
      } finally {
        creatingChatRef.current = null;
      }
    })();

    creatingChatRef.current = task;
    return task;
  }, [router, setDraftMessage, setErrorState]);

  const handleDeleteChat = useCallback(async (id: string) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/conversations/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setConversations(prev => prev.filter(c => String(c.id) !== String(id)));
      if (String(activeConversationId) === String(id)) setActiveConversationId(null);
    } catch (error: any) {
      setErrorState({ message: error.message || "Failed to delete chat" });
    }
  }, [activeConversationId, setErrorState]);

  const handleClearAllChats = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/conversations`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setConversations([]);
      setActiveConversationId(null);
    } catch (error: any) {
      setErrorState({ message: error.message || "Failed to clear chats" });
    }
  }, [setErrorState]);

  const handleExportChats = useCallback(() => {
    if (!Array.isArray(conversations) || conversations.length === 0) return;
    const dataStr = JSON.stringify(conversations, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vatsa-chats-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [conversations]);

  const handlePinChat = useCallback(async (id: string) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/conversations/${id}/pin`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      updateConversation(id, (conv) => ({ ...conv, pinned: true }));
    } catch {}
  }, [updateConversation]);

  const handleUnpinChat = useCallback(async (id: string) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/conversations/${id}/pin`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      updateConversation(id, (conv) => ({ ...conv, pinned: false }));
    } catch {}
  }, [updateConversation]);

  const handleToggleFavorite = useCallback(async (id: string) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    const conv = conversations.find(c => String(c.id) === String(id));
    if (!conv) return;
    try {
      await fetch(`${API_BASE}/api/conversations/${id}/favorite`, {
        method: conv.favorite ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      updateConversation(id, (c) => ({ ...c, favorite: !c.favorite }));
    } catch {}
  }, [conversations, updateConversation]);

  const handleDuplicateChat = useCallback(async (id: string) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/conversations/${id}/duplicate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Duplicate failed");
      const raw = await response.json();
      const rawConv = raw?.conversation ?? raw?.data ?? raw;
      const newConv = normalizeConv(rawConv);
      setConversations(prev => dedupeConversations([newConv, ...prev]));
    } catch {}
  }, []);

  const handleArchiveChat = useCallback(async (id: string) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/conversations/${id}/archive`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      updateConversation(id, (conv) => ({ ...conv, archived: true }));
    } catch {}
  }, [updateConversation]);

  return {
    conversations, setConversations,
    activeConversationId, setActiveConversationId,
    activeConv, messages,
    loading,
    updateConversation, addMessageToConversation,
    handleNewChat, handleDeleteChat, handleClearAllChats, handleExportChats,
    handleRenameChat, handlePinChat, handleUnpinChat, handleToggleFavorite,
    handleDuplicateChat, handleArchiveChat,
  };
}
