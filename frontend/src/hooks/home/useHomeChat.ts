import { useState, useCallback, useRef, useEffect } from "react";
import type { Message, Conversation } from "@/types";
import type { Attachment } from "@/types/home";
import { API_BASE } from "@/lib/home/constants";
import { isImageGenQuery } from "@/lib/home/imageQuery";

interface UseHomeChatParams {
  activeConversationId: string | null;
  conversations: Conversation[];
  messages: Message[];
  privateMode: boolean;
  user: any;
  attachments: Attachment[];
  setAttachments: (updater: Attachment[] | ((prev: Attachment[]) => Attachment[])) => void;
  webSearchEnabled: boolean;
  addMessageToConversation: (convId: string, msg: Message) => void;
  updateConversation: (id: string, updater: (conv: Conversation) => Conversation) => void;
  handleRenameChat: (id: string, title: string) => Promise<void>;
  handleNewChat: (onCreated?: () => void) => Promise<string | null>;
  setDraftMessage: (v: string) => void;
  setInputValue: (v: string) => void;
  setIsFirstMessage: (v: boolean) => void;
  setErrorState: (err: { message: string; stack?: string } | null) => void;
}

/**
 * Owns sending a prompt (including implicit image generation, attachments,
 * and creating a conversation on the fly), plus the per-message actions:
 * retry, regenerate, copy, feedback, share. Conversation CRUD itself lives
 * in useHomeConversations.
 */
export function useHomeChat(params: UseHomeChatParams) {
  const {
    activeConversationId, conversations, messages, privateMode, user,
    attachments, setAttachments, webSearchEnabled, addMessageToConversation, updateConversation, handleRenameChat,
    handleNewChat, setDraftMessage, setInputValue, setIsFirstMessage, setErrorState,
  } = params;

  const [isLoading, setIsLoading] = useState(false);
  const [isImageGenLoading, setIsImageGenLoading] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, "up" | "down" | null>>({});
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    const hasAttachments = attachments.some(a => a.status === "ready");
    if (!content.trim() && !hasAttachments) return;

    if (isLoading) {
      abortControllerRef.current?.abort();
      setIsLoading(false);
      setIsImageGenLoading(false);
      return;
    }

    const willGenImage = isImageGenQuery(content) && !hasAttachments;

    let convId = activeConversationId;
    if (!convId) {
      const newId = await handleNewChat();
      if (!newId) return;
      convId = newId;
    }

    const conv = conversations.find(c => String(c.id) === String(convId));
    const isFirst = !!conv && (conv.messages?.length ?? 0) === 0 && (conv.title === "New Chat" || !conv.title);

    const readyAttachments = attachments.filter(a => a.status === "ready");
    const payloadAttachments = readyAttachments.map(a => ({
      name: a.name, type: a.type, size: a.size, is_base64: a.isBase64, content: a.content,
    }));

    let messageText = content.trim();
    const inlineText = readyAttachments
      .filter(a => !a.isBase64 && a.content)
      .map(a => `\n\n--- File: ${a.name} ---\n${a.content}`)
      .join("");
    if (inlineText) messageText = `${messageText}${inlineText}`.trim();

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim() || `📎 ${readyAttachments.map(a => a.name).join(", ")}`,
      createdAt: new Date().toISOString(),
      // @ts-ignore
      attachments: payloadAttachments,
    };
    addMessageToConversation(convId, userMsg);
    setInputValue("");
    setDraftMessage("");
    setAttachments([]);

    if (isFirst) setIsFirstMessage(false);

    if (isFirst && !privateMode && content.trim()) {
      const newTitle = content.trim().slice(0, 35) + (content.trim().length > 35 ? "..." : "");
      if (newTitle !== "New Chat") await handleRenameChat(convId, newTitle);
    }

    setIsLoading(true);
    if (willGenImage) setIsImageGenLoading(true);
    abortControllerRef.current = new AbortController();

    const token = localStorage.getItem("access_token");
    const userId = user?.email || `user_${Date.now()}`;
    let streamAssistantId: string | null = null;
    let lastStreamedText = "";

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream, application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          message: messageText,
          userId: userId,
          conversation_id: convId,
          userTier: "free",
          attachments: payloadAttachments,
          stream: true,
          web_search: willGenImage ? false : webSearchEnabled,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get("content-type") || "";
      let textContent = "";
      let imageUrl: string | undefined;
      let selectedModel = "Vatsa AI";

      if (contentType.includes("text/event-stream") && response.body) {
        /* ── Streaming path ── */
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamedText = "";
        let sseError: string | null = null;
        let sources: any[] | undefined;

        const assistantId = (Date.now() + 1).toString();
        streamAssistantId = assistantId;
        addMessageToConversation(convId, {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
          model: "Vatsa AI",
          isStreaming: true,
        });

        const flush = () => {
          lastStreamedText = streamedText;
          updateConversation(convId, (conv) => ({
            ...conv,
            messages: (conv.messages || []).map((m) =>
              m.id === assistantId ? { ...m, content: streamedText } : m
            ),
          }));
        };

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
              if (evt.error) sseError = evt.error;
              else if (evt.delta) streamedText += evt.delta;
              else if (evt.done && evt.sources) sources = evt.sources;
              flush();
            } catch {
              streamedText += payload;
              flush();
            }
            if (sseError) break;
          }
          if (sseError) break;
        }

        if (sseError) throw new Error(sseError);

        textContent = streamedText;

        // Extract an embedded image separately -- ReactMarkdown blocks `data:` URLs
        const m = textContent.match(/!\[[^\]]*\]\((data:image\/[^)\s]+|https?:\/\/[^)\s]+)\)/);
        if (m) {
          imageUrl = m[1];
          textContent = textContent
            .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
            .replace(/\*\*Vatsa AI Image\*\*/g, "")
            .replace(/\*\*Generated Image\*\*/g, "")
            .trim();
        }

        updateConversation(convId, (conv) => ({
          ...conv,
          messages: (conv.messages || []).map((m2) =>
            m2.id === assistantId
              ? {
                  ...m2,
                  content: textContent || (imageUrl ? "" : "No response from AI"),
                  isStreaming: false,
                  sources,
                  // @ts-ignore
                  imageUrl,
                }
              : m2
          ),
        }));
      } else {
        /* ── Non-streaming (JSON) path -- e.g. image generation ── */
        const data = await response.json();
        imageUrl = data.image_url;
        textContent = data.response || "No response from AI";
        selectedModel = data.selected_model || "Vatsa AI";
        const sources = data.sources;

        if (!imageUrl && textContent) {
          const m = textContent.match(/!\[[^\]]*\]\((data:image\/[^)\s]+|https?:\/\/[^)\s]+)\)/);
          if (m) {
            imageUrl = m[1];
            textContent = textContent
              .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
              .replace(/\*\*Vatsa AI Image\*\*/g, "")
              .replace(/\*\*Generated Image\*\*/g, "")
              .trim();
          }
        }

        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: textContent || (imageUrl ? "" : "No response from AI"),
          createdAt: new Date().toISOString(),
          model: selectedModel,
          sources,
          // @ts-ignore
          imageUrl,
        };
        addMessageToConversation(convId, assistantMsg);
      }

      setErrorState(null);
    } catch (error: any) {
      const isAbort = error.name === "AbortError";
      const fallbackContent = isAbort
        ? (lastStreamedText || "⏹️ Generation stopped.")
        : `⚠️ Failed: ${error.message || "Unknown error"}`;

      if (streamAssistantId) {
        // A streaming placeholder is already in the conversation -- finish
        // it in place instead of leaving a stuck "isStreaming" bubble and
        // appending a second, disconnected message.
        updateConversation(convId, (conv) => ({
          ...conv,
          messages: (conv.messages || []).map((m) =>
            m.id === streamAssistantId
              ? { ...m, content: fallbackContent, isStreaming: false }
              : m
          ),
        }));
      } else {
        addMessageToConversation(convId, {
          id: (Date.now() + 1).toString(), role: "assistant",
          content: fallbackContent, createdAt: new Date().toISOString(),
        });
      }
      setErrorState(isAbort ? null : { message: error.message || "Unknown error", stack: error.stack });
    } finally {
      setIsLoading(false);
      setIsImageGenLoading(false);
    }
  }, [
    activeConversationId, conversations, privateMode, user, attachments, webSearchEnabled,
    isLoading, addMessageToConversation, updateConversation, handleRenameChat, handleNewChat,
    setDraftMessage, setAttachments, setInputValue, setIsFirstMessage, setErrorState,
  ]);

  const handleRetry = useCallback(() => {
    if (messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
      if (lastUserMsg) { sendMessage(lastUserMsg.content); setErrorState(null); }
    }
  }, [messages, sendMessage, setErrorState]);

  const handleRegenerate = useCallback(async (msgId: string, updateConversation: (id: string, updater: (conv: Conversation) => Conversation) => void) => {
    if (isLoading || !activeConversationId) return;
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx < 1) return;
    const prevUser = [...messages.slice(0, idx)].reverse().find((m) => m.role === "user");
    if (!prevUser) return;

    updateConversation(activeConversationId, (conv) => ({
      ...conv,
      messages: (conv.messages || []).filter((_, i) => i < idx),
    }));

    await sendMessage(prevUser.content);
  }, [isLoading, activeConversationId, messages, sendMessage]);

  const handleCopy = useCallback(async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId((v) => (v === msgId ? null : v)), 1500);
    } catch (e) { console.error("Copy failed:", e); }
  }, []);

  const handleFeedback = useCallback((msgId: string, dir: "up" | "down") => {
    setFeedback((prev) => ({ ...prev, [msgId]: prev[msgId] === dir ? null : dir }));
  }, []);

  const handleShare = useCallback(async (content: string) => {
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title: "Vatsa AI", text: content });
      } else {
        await navigator.clipboard.writeText(content);
      }
    } catch {}
  }, []);

  return {
    isLoading, setIsLoading,
    isImageGenLoading, setIsImageGenLoading,
    feedback, copiedMsgId,
    abortControllerRef,
    sendMessage, handleRetry, handleRegenerate, handleCopy, handleFeedback, handleShare,
  };
}
