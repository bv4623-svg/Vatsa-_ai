import { useState, useCallback, useRef, useEffect } from "react";
import type { Message, Conversation } from "@/types";
import type { Attachment } from "@/types/home";
import { API_BASE } from "@/lib/home/constants";
import { isImageGenQuery } from "@/lib/home/imageQuery";
import { UpgradeRequiredError, parseUpgradeGate, type UpgradeGateInfo } from "@/lib/billing/upgradeError";
import { createSseParser, describeHttpError, describeNetworkError, researchStageLabel } from "@/lib/home/sse";

export { UpgradeRequiredError, type UpgradeGateInfo };

interface UseHomeChatParams {
  activeConversationId: string | null;
  conversations: Conversation[];
  messages: Message[];
  privateMode: boolean;
  user: any;
  attachments: Attachment[];
  setAttachments: (updater: Attachment[] | ((prev: Attachment[]) => Attachment[])) => void;
  webSearchEnabled: boolean;
  reasoningEnabled: boolean;
  /** Send questions to deep research (Business) instead of chat. */
  researchEnabled?: boolean;
  addMessageToConversation: (convId: string, msg: Message) => void;
  updateConversation: (id: string, updater: (conv: Conversation) => Conversation) => void;
  handleRenameChat: (id: string, title: string) => Promise<void>;
  handleNewChat: (onCreated?: () => void) => Promise<string | null>;
  setDraftMessage: (v: string) => void;
  setInputValue: (v: string) => void;
  setIsFirstMessage: (v: boolean) => void;
  setErrorState: (err: { message: string; stack?: string } | null) => void;
  onUpgradeRequired?: (info: UpgradeGateInfo) => void;
  /** A reply finished successfully (used to read it aloud in voice mode). */
  onAssistantDone?: (messageId: string, content: string) => void;
}

/**
 * Owns sending a prompt (including implicit image generation, attachments,
 * and creating a conversation on the fly), plus the per-message actions:
 * retry, regenerate, copy, feedback, share. Conversation CRUD itself lives
 * in useHomeConversations.
 */
export function useHomeChat(params: UseHomeChatParams) {
  const {
    activeConversationId, conversations, messages, privateMode,
    attachments, setAttachments, webSearchEnabled, reasoningEnabled, researchEnabled = false,
    addMessageToConversation, updateConversation, handleRenameChat,
    handleNewChat, setDraftMessage, setInputValue, setIsFirstMessage, setErrorState, onUpgradeRequired, onAssistantDone,
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
    // Research works from the question alone; attachments and image
    // requests go through normal chat.
    const willResearch = researchEnabled && !willGenImage && !hasAttachments;

    let convId = activeConversationId;
    if (!convId) {
      const newId = await handleNewChat();
      if (!newId) return;
      convId = newId;
    }

    const conv = conversations.find(c => String(c.id) === String(convId));
    const isFirst = !!conv && (conv.messages?.length ?? 0) === 0 && (conv.title === "New Chat" || !conv.title);

    const readyAttachments = attachments.filter(a => a.status === "ready");
    // Text/document attachments travel inlined in the message below; only
    // images need their bytes in the attachments array (as vision input).
    const payloadAttachments = readyAttachments.map(a => ({
      name: a.name, type: a.type, size: a.size, is_base64: a.isBase64,
      ...(a.isBase64 ? { content: a.content } : {}),
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
    let streamAssistantId: string | null = null;
    let lastStreamedText = "";

    const patchAssistant = (id: string, patch: Partial<Message>) =>
      updateConversation(convId!, (c) => ({
        ...c,
        messages: (c.messages || []).map((m) => (m.id === id ? { ...m, ...patch } : m)),
      }));

    try {
      const response = await fetch(`${API_BASE}${willResearch ? "/api/research" : "/api/chat"}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream, application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(
          willResearch
            ? { message: content.trim(), conversation_id: convId }
            : {
                message: messageText,
                conversation_id: convId,
                attachments: payloadAttachments,
                stream: true,
                web_search: willGenImage ? false : webSearchEnabled,
                reasoning: willGenImage ? false : reasoningEnabled,
              }
        ),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const upgradeError = await parseUpgradeGate(response.clone());
        if (upgradeError) throw upgradeError;
        const body = await response.json().catch(() => null);
        throw new Error(describeHttpError(response.status, body));
      }

      const contentType = response.headers.get("content-type") || "";
      let textContent = "";
      let imageUrl: string | undefined;

      if (contentType.includes("text/event-stream") && response.body) {
        /* ── Streaming path (chat and deep research) ── */
        const reader = response.body.getReader();
        let streamedText = "";
        let thinkingText = "";
        let sseError: string | null = null;
        let sources: Message["sources"];
        let notice: string | undefined;
        let researchStatus: string | undefined;
        const researchLog: string[] = [];

        const assistantId = (Date.now() + 1).toString();
        streamAssistantId = assistantId;
        addMessageToConversation(convId, {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
          model: "Vatsa AI",
          isStreaming: true,
          researchStatus: willResearch ? "Starting research…" : undefined,
        });

        const flush = () => {
          lastStreamedText = streamedText;
          patchAssistant(assistantId, {
            content: streamedText,
            thinking: thinkingText || undefined,
            notice,
            researchStatus,
          });
        };

        const parser = createSseParser((evt) => {
          if (evt.error) {
            sseError = evt.error;
            return;
          }
          if (evt.stage) {
            researchStatus = researchStageLabel(evt) || researchStatus;
            if (evt.stage === "searching" && evt.queries?.length) {
              researchLog.push("Planned searches:", ...evt.queries.map((q) => `- ${q}`));
            }
            if (evt.stage === "writing") researchLog.push(`Read ${evt.source_count ?? 0} sources.`);
            thinkingText = researchLog.join("\n");
          }
          if (evt.notice) notice = evt.notice;
          if (evt.thinking) thinkingText += evt.thinking;
          if (evt.delta) {
            streamedText += evt.delta;
            researchStatus = undefined;
          }
          if (evt.done && Array.isArray(evt.sources)) sources = evt.sources as Message["sources"];
          flush();
        });

        while (!sseError) {
          const { done, value } = await reader.read();
          if (done) {
            parser.end();
            break;
          }
          parser.feed(value);
        }

        if (sseError) {
          if (streamedText) {
            // Keep what already arrived and say it was cut short.
            patchAssistant(assistantId, {
              content: `${streamedText}\n\n⚠️ ${sseError}`,
              isStreaming: false, researchStatus: undefined, isError: true,
            });
            streamAssistantId = null;
            setErrorState({ message: sseError });
            return;
          }
          throw new Error(sseError);
        }

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

        const finalContent = textContent || (imageUrl ? "" : "No response from AI");
        patchAssistant(assistantId, {
          content: finalContent,
          isStreaming: false,
          researchStatus: undefined,
          sources,
          notice,
          thinking: thinkingText || undefined,
          imageUrl,
        });
        onAssistantDone?.(assistantId, finalContent);
      } else {
        /* ── Non-streaming (JSON) path -- e.g. image generation ── */
        const data = await response.json();
        imageUrl = data.image_url;
        textContent = data.response || "No response from AI";

        // The server sends the image both as image_url and inline markdown; strip the inline copy so it renders once.
        if (textContent) {
          const m = textContent.match(/!\[[^\]]*\]\((data:image\/[^)\s]+|https?:\/\/[^)\s]+)\)/);
          if (m) {
            imageUrl = imageUrl || m[1];
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
          model: data.selected_model || "Vatsa AI",
          sources: data.sources,
          thinking: data.reasoning || undefined,
          notice: data.notice,
          imageUrl,
        };
        addMessageToConversation(convId, assistantMsg);
        onAssistantDone?.(assistantMsg.id, assistantMsg.content);
      }

      setErrorState(null);
    } catch (error: unknown) {
      const err = error as Error;
      const isAbort = err?.name === "AbortError";
      const isUpgradeGate = error instanceof UpgradeRequiredError;
      const reason = describeNetworkError(error, typeof navigator === "undefined" || navigator.onLine);
      const fallbackContent = isAbort
        ? (lastStreamedText || "⏹️ Generation stopped.")
        : isUpgradeGate
        ? (error.info.error === "daily_limit_reached"
            ? `You've used all ${error.info.limit} ${error.info.feature === "deep_research" ? "deep research reports" : "free requests"} for today.`
            : error.info.feature === "deep_research"
            ? "Deep research is available on the Business plan."
            : "That's a Pro feature.")
        : `⚠️ ${reason}`;

      if (isUpgradeGate) {
        onUpgradeRequired?.(error.info);
      }

      const failed = !isAbort && !isUpgradeGate;
      if (streamAssistantId) {
        // A streaming placeholder is already in the conversation -- finish
        // it in place instead of leaving a stuck "isStreaming" bubble and
        // appending a second, disconnected message.
        patchAssistant(streamAssistantId, { content: fallbackContent, isStreaming: false, researchStatus: undefined, isError: failed });
      } else {
        addMessageToConversation(convId, {
          id: (Date.now() + 1).toString(), role: "assistant",
          content: fallbackContent, createdAt: new Date().toISOString(), isError: failed,
        });
      }
      setErrorState(failed ? { message: reason } : null);
    } finally {
      setIsLoading(false);
      setIsImageGenLoading(false);
    }
  }, [
    activeConversationId, conversations, privateMode, attachments, webSearchEnabled, reasoningEnabled, researchEnabled,
    isLoading, addMessageToConversation, updateConversation, handleRenameChat, handleNewChat,
    setDraftMessage, setAttachments, setInputValue, setIsFirstMessage, setErrorState, onUpgradeRequired, onAssistantDone,
  ]);

  /** Drops messages from `fromIndex` on (so the resend doesn't show the
   * question twice) and sends `content` again. */
  const resendFrom = useCallback(async (fromIndex: number, content: string) => {
    if (!activeConversationId) return;
    updateConversation(activeConversationId, (conv) => ({
      ...conv,
      messages: (conv.messages || []).slice(0, fromIndex),
    }));
    await sendMessage(content);
  }, [activeConversationId, updateConversation, sendMessage]);

  const handleRetry = useCallback(() => {
    if (isLoading) return;
    const idx = messages.map((m) => m.role).lastIndexOf("user");
    if (idx < 0) return;
    setErrorState(null);
    void resendFrom(idx, messages[idx].content);
  }, [isLoading, messages, resendFrom, setErrorState]);

  const handleRegenerate = useCallback(async (msgId: string, _update?: unknown) => {
    if (isLoading || !activeConversationId) return;
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx < 1) return;
    const userIdx = messages.slice(0, idx).map((m) => m.role).lastIndexOf("user");
    if (userIdx < 0) return;
    await resendFrom(userIdx, messages[userIdx].content);
  }, [isLoading, activeConversationId, messages, resendFrom]);

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
