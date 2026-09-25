import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { useRouter } from "next/navigation";
import type { Conversation, ChatMessage } from "@/services/chat";
import type { User } from "@/stores/auth";
import { useIsMounted } from "@/hooks/useIsMounted";
import { API_BASE } from "@/config/api";
import { parseUpgradeGate } from "@/lib/billing/upgradeError";


/**
 * Owns the Code workspace's project/conversation list: fetching it from the
 * backend, creating/deleting projects, switching the active one, and
 * appending messages to it. Kept separate from the AI-chat-sending logic
 * (useCodeChat) so each hook has one clear responsibility.
 */
export function useCodeConversations(
  accessToken: string | null,
  router: ReturnType<typeof useRouter>,
  user: User | null
) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);

  const conversationsRef = useRef<Conversation[]>([]);
  const activeProjectIdRef = useRef<string | null>(null);
  const isMountedRef = useIsMounted();

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  const fetchConversations = useCallback(async () => {
    try {
      if (!accessToken) {
        router.push("/login");
        return;
      }
      const res = await fetch(
        `${API_BASE}/api/conversations?workspace=code`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        console.warn(`Conversations fetch failed: ${res.statusText}`);
        return;
      }
      const data = await res.json();
      const serverList: Conversation[] = Array.isArray(data) ? data : [];

      setConversations((prev) => {
        const map = new Map<string, Conversation>();
        for (const c of serverList) map.set(c.id as string, c);
        for (const c of prev) {
          const existing = map.get(c.id as string);
          if (!existing) map.set(c.id as string, c);
          else if (
            (c.messages?.length || 0) > (existing.messages?.length || 0)
          ) {
            map.set(c.id as string, { ...existing, messages: c.messages });
          }
        }
        return Array.from(map.values()).sort((a, b) => {
          const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return tb - ta;
        });
      });
    } catch (err) {
      console.warn("fetchConversations error:", err);
    } finally {
      if (isMountedRef.current) setIsLoadingConversations(false);
    }
  }, [accessToken, router, isMountedRef]);

  useEffect(() => {
    if (accessToken) {
      fetchConversations();
    }
  }, [accessToken, fetchConversations]);

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeProjectId) || null,
    [conversations, activeProjectId]
  );
  const currentMessages = activeConv?.messages || [];

  const updateConversationMessages = useCallback(
    (convId: string, newMessages: ChatMessage[]) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: newMessages,
                updatedAt: new Date().toISOString(),
              }
            : c
        )
      );
    },
    []
  );

  const createProject = useCallback(
    async (title: string): Promise<string> => {
      if (!accessToken) throw new Error("Not signed in");

      const res = await fetch(`${API_BASE}/api/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ title, workspace: "code" }),
      });

      if (!res.ok) {
        // A 403 here means the free/pro/business code-app cap was hit --
        // surfaced to the caller as a real error so it can show the
        // upgrade modal, never silently faked as a local-only project
        // that would vanish the moment the page refreshes.
        const gate = await parseUpgradeGate(res);
        if (gate) throw gate;
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail?.message || body?.detail || `Could not create project (${res.status})`);
      }

      const data = await res.json();
      const now = new Date().toISOString();
      const id = data.id as string;
      const conv: Conversation = {
        id,
        title: data.title || title,
        workspace: "code",
        messages: [],
        created_at: now,
        updated_at: now,
        createdAt: now,
        updatedAt: now,
        user_id: user?.id ? Number(user.id) : 0,
      };
      setConversations((prev) => (prev.some((c) => c.id === id) ? prev : [conv, ...prev]));
      return id;
    },
    [accessToken, user]
  );

  const handleDeleteProject = useCallback(
    async (id: string, onActiveDeleted?: () => void) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeProjectIdRef.current === id) {
        setActiveProjectId(null);
        onActiveDeleted?.();
      }
      if (id.startsWith("local-")) return;
      try {
        if (!accessToken) return;
        await fetch(`${API_BASE}/api/conversations/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch {
        /* fire & forget */
      }
    },
    [accessToken]
  );

  const handleUserSwitchProject = useCallback(
    (id: string, onSwitch?: () => void) => {
      if (id === activeProjectIdRef.current) return;
      onSwitch?.();
      setActiveProjectId(id);
      activeProjectIdRef.current = id;
    },
    []
  );

  return {
    conversations,
    setConversations,
    activeProjectId,
    setActiveProjectId,
    isLoadingConversations,
    activeConv,
    currentMessages,
    conversationsRef,
    activeProjectIdRef,
    isMountedRef,
    fetchConversations,
    createProject,
    updateConversationMessages,
    handleDeleteProject,
    handleUserSwitchProject,
  };
}
