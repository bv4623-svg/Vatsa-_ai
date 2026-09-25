import { useState, useRef, useCallback, type RefObject } from "react";
import type { Conversation, ChatMessage } from "@/services/chat";
import type { ProjectFile } from "@/types/code";
import { uid, normalizeResponse } from "@/lib/code/parsing";
import { useIsMounted } from "@/hooks/useIsMounted";
import { parseUpgradeGate, UpgradeRequiredError, type UpgradeGateInfo } from "@/lib/billing/upgradeError";
import { API_BASE } from "@/config/api";


interface UseCodeChatParams {
  accessToken: string | null;
  model: string;
  conversationsRef: RefObject<Conversation[]>;
  activeProjectIdRef: RefObject<string | null>;
  setActiveProjectId: (id: string) => void;
  createProject: (title: string) => Promise<string>;
  updateConversationMessages: (convId: string, messages: ChatMessage[]) => void;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  notify: (message: string, kind?: "success" | "error" | "info") => void;
  onSendStart: () => void;
  onFilesGenerated: (files: ProjectFile[], main: ProjectFile) => void;
  onUpgradeRequired?: (info: UpgradeGateInfo) => void;
}

/**
 * Owns sending a prompt to the AI (streaming or not), the resulting loading
 * state, prompt history, and regenerate/edit actions. Deliberately doesn't
 * own the code-preview panel's own state (files/codeContent/etc) -- that
 * stays in the parent and is updated via the onFilesGenerated callback.
 */
export function useCodeChat(params: UseCodeChatParams) {
  const {
    accessToken, model, conversationsRef, activeProjectIdRef,
    setActiveProjectId, createProject, updateConversationMessages,
    setConversations, notify, onSendStart, onFilesGenerated, onUpgradeRequired,
  } = params;

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useIsMounted();

  const sendMessage = useCallback(
    async (content: string, opts?: { regenerateFrom?: number }) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      if (isLoading) {
        abortRef.current?.abort();
        setIsLoading(false);
        return;
      }

      let convId = activeProjectIdRef.current;
      if (!convId) {
        const title = trimmed.slice(0, 40) + (trimmed.length > 40 ? "…" : "");
        try {
          convId = await createProject(title || "New Project");
        } catch (err) {
          if (err instanceof UpgradeRequiredError) {
            onUpgradeRequired?.(err.info);
          } else {
            notify(err instanceof Error ? err.message : "Could not create a new project", "error");
          }
          return;
        }
        setActiveProjectId(convId);
        activeProjectIdRef.current = convId;
      }

      const conversation = conversationsRef.current.find(
        (c) => c.id === convId
      );
      let baseMessages = conversation?.messages || [];

      // Regenerate: trim off trailing assistant messages
      if (opts?.regenerateFrom != null) {
        baseMessages = baseMessages.slice(0, opts.regenerateFrom);
      }

      const userMsg: ChatMessage = {
        id: uid("user"),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
        status: "done",
        edited: false,
        bookmarked: false,
        attachments: [],
      };
      const withUser = [...baseMessages, userMsg];
      updateConversationMessages(convId, withUser);

      setInputValue("");
      setPromptHistory((h) => [trimmed, ...h].slice(0, 50));
      setHistoryCursor(-1);
      onSendStart();
      setIsLoading(true);

      // Title from first message
      if (baseMessages.length === 0) {
        const newTitle =
          trimmed.slice(0, 40) + (trimmed.length > 40 ? "…" : "");
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId ? { ...c, title: newTitle } : c
          )
        );
      }

      if (!accessToken) {
        notify("Not authenticated", "error");
        setIsLoading(false);
        return;
      }

      try {
        abortRef.current = new AbortController();
        const response = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream, application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: trimmed,
            model,
            conversation_id: convId,
            workspace: "code",
            stream: true,
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const upgradeError = await parseUpgradeGate(response);
          if (upgradeError) throw upgradeError;
          let msg = "Failed to get response from AI";
          try {
            const err = await response.json();
            msg = err.message || err.detail || msg;
          } catch {}
          throw new Error(msg);
        }

        const contentType = response.headers.get("content-type") || "";
        let text = "";
        let parsedFiles: ProjectFile[] = [];

        if (
          contentType.includes("text/event-stream") &&
          response.body
        ) {
          /* ── Streaming path ── */
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let streamedText = "";
          let sseError: string | null = null;

          // Insert a placeholder assistant message
          const assistantId = uid("assistant");
          const placeholder: ChatMessage = {
            id: assistantId,
            role: "assistant",
            content: "",
            createdAt: new Date().toISOString(),
            status: "streaming",
            edited: false,
            bookmarked: false,
            attachments: [],
            model: "Vatsa AI",
          };
          updateConversationMessages(convId, [...withUser, placeholder]);

          const flush = () => {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === convId
                  ? {
                      ...c,
                      messages: (c.messages || []).map((m) =>
                        m.id === assistantId
                          ? { ...m, content: streamedText }
                          : m
                      ),
                      updatedAt: new Date().toISOString(),
                    }
                  : c
              )
            );
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
                if (typeof evt === "string") streamedText += evt;
                else if (evt.error) sseError = evt.error;
                else if (evt.done) { /* usage/conversation_id available, no-op here */ }
                else if (evt.delta) streamedText += evt.delta;
                else if (evt.token) streamedText += evt.token;
                else if (evt.content) streamedText += evt.content;
                else if (evt.response) streamedText += evt.response;
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

          text = streamedText;
          const finalNorm = normalizeResponse({ response: text });
          parsedFiles = finalNorm.files;

          // Update final message
          updateConversationMessages(
            convId,
            conversationsRef.current.find((c) => c.id === convId)?.messages?.map((m) =>
              m.id === assistantId ? { ...m, content: text, status: "done" } : m
            ) || []
          );
        } else {
          /* ── Non-streaming path ── */
          const data = await response.json();
          const normalized = normalizeResponse(data);
          text = normalized.text;
          parsedFiles = normalized.files;

          const assistantMsg: ChatMessage = {
            id: uid("assistant"),
            role: "assistant",
            content: text || "Done.",
            createdAt: new Date().toISOString(),
            status: "done",
            edited: false,
            bookmarked: false,
            attachments: [],
            model: "Vatsa AI",
          };
          updateConversationMessages(convId, [...withUser, assistantMsg]);
        }

        if (parsedFiles.length > 0) {
          const main =
            parsedFiles.find((f) => /index\.html?$/i.test(f.name)) ||
            parsedFiles.find((f) => /\.html?$/i.test(f.name)) ||
            parsedFiles[0];
          onFilesGenerated(parsedFiles, main);
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          updateConversationMessages(convId, [
            ...withUser,
            {
              id: uid("stopped"),
              role: "assistant",
              content: "⏹️ Generation stopped.",
              createdAt: new Date().toISOString(),
              status: "stopped",
              edited: false,
              bookmarked: false,
              attachments: [],
            },
          ]);
        } else if (err instanceof UpgradeRequiredError) {
          const fallbackContent =
            err.info.error === "daily_limit_reached"
              ? `You've used all ${err.info.limit} free code messages for today.`
              : "That's a Pro feature.";
          updateConversationMessages(convId, [
            ...withUser,
            {
              id: uid("assistant"),
              role: "assistant",
              content: fallbackContent,
              createdAt: new Date().toISOString(),
              status: "done",
              edited: false,
              bookmarked: false,
              attachments: [],
            },
          ]);
          onUpgradeRequired?.(err.info);
        } else {
          console.error("Chat error:", err);
          notify(err.message || "Failed to get response.", "error");
          updateConversationMessages(convId, [
            ...withUser,
            {
              id: uid("error"),
              role: "assistant",
              content:
                "⚠️ " + (err.message || "An error occurred. Please try again."),
              createdAt: new Date().toISOString(),
              status: "error",
              edited: false,
              bookmarked: false,
              attachments: [],
            },
          ]);
        }
      } finally {
        if (isMountedRef.current) setIsLoading(false);
        abortRef.current = null;
      }
    },
    [
      isLoading, model, updateConversationMessages, createProject, notify,
      accessToken, activeProjectIdRef, conversationsRef, setActiveProjectId,
      setConversations, onSendStart, onFilesGenerated, onUpgradeRequired, isMountedRef,
    ]
  );

  const regenerateLast = useCallback(() => {
    const msgs = conversationsRef.current.find(
      (c) => c.id === activeProjectIdRef.current
    )?.messages;
    if (!msgs) return;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "user") {
        sendMessage(msgs[i].content, { regenerateFrom: i });
        return;
      }
    }
  }, [sendMessage, conversationsRef, activeProjectIdRef]);

  const editUserMessage = useCallback(
    (msg: ChatMessage, inputRef: RefObject<HTMLTextAreaElement | null>) => {
      setInputValue(msg.content);
      inputRef.current?.focus();
    },
    []
  );

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (inputValue.trim()) sendMessage(inputValue);
        return;
      }
      if (e.key === "ArrowUp" && !inputValue && promptHistory.length) {
        e.preventDefault();
        const next = Math.min(historyCursor + 1, promptHistory.length - 1);
        setHistoryCursor(next);
        setInputValue(promptHistory[next]);
      }
      if (e.key === "ArrowDown" && historyCursor >= 0) {
        e.preventDefault();
        const next = historyCursor - 1;
        setHistoryCursor(next);
        setInputValue(next >= 0 ? promptHistory[next] : "");
      }
    },
    [inputValue, sendMessage, promptHistory, historyCursor]
  );

  const resetForNewProject = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
    setInputValue("");
  }, []);

  return {
    inputValue,
    setInputValue,
    isLoading,
    setIsLoading,
    abortRef,
    sendMessage,
    regenerateLast,
    editUserMessage,
    onInputKeyDown,
    resetForNewProject,
  };
}
