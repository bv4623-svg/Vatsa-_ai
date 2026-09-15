"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Send, Loader, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import Sidebar from "@/components/layout/sidebar";
import BuildingScreen from "@/components/workspace/BuildingScreen";
import EditorLayout from "@/components/workspace/EditorLayout";
import { WorkspaceHome } from "@/features/workspace/components/WorkspaceHome";
import { sendWorkspaceMessage } from "@/features/workspace/services/workspace-chat.service";
import type { Message } from "@/types";

// ─── Constants ──────────────────────────────────────────────────────────

// ─── Main Workspace Page ──────────────────────────────────────────────
export default function WorkspacePage() {
  const { mode, setMode } = useWorkspaceStore();

  // ── Chat state ──
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [codeContent, setCodeContent] = useState(""); // will be passed to EditorLayout

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Handle sending message (chat & code generation) ──
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // If this is the first user message, switch mode to 'editor'
    if (mode === "idle") {
      setMode("editor");
      setShowCodePanel(false); // reset code panel
    }

    try {
      const data = await sendWorkspaceMessage(content.trim());
      const aiResponse = data.response || "No response from AI";

      // Add assistant message
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: aiResponse,
        createdAt: new Date().toISOString(),
        model: data.selected_model || "Vatsa AI",
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // ── Extract code block if present ──
      const codeMatch = aiResponse.match(/```([\s\S]*?)```/);
      if (codeMatch) {
        const extractedCode = codeMatch[1].trim();
        setCodeContent(extractedCode);
        setShowCodePanel(true);
        // Also update workspace store if needed (e.g., for EditorLayout)
        // We'll pass codeContent as prop later.
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `⚠️ Failed to get response. ${error.message || "Unknown error"}`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Handle quick start from dashboard ──
  const handleQuickStart = (prompt: string) => {
    // This will trigger sendMessage and also switch mode
    sendMessage(prompt);
  };

  // ── Render ──
  return (
    <div className="flex h-screen w-full overflow-hidden bg-black/90">
      <Sidebar
        mobileOpen={false}
        onCloseMobile={() => undefined}
        onNewChat={() => setMessages([])}
        onOpenSettings={() => undefined}
        onOpenSearch={() => undefined}
        searchRef={searchRef}
      />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <AnimatePresence mode="wait">
          {mode === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 overflow-y-auto"
            >
              <WorkspaceHome onQuickStart={handleQuickStart} />
            </motion.div>
          )}

          {(mode === "editor" || mode === "building" || mode === "preview" || mode === "fixing") && (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              {/* ── Top: Chat Area ── */}
              <div className={`${showCodePanel ? "h-1/2" : "h-full"} flex flex-col overflow-hidden`}>
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                      <MessageSquare size={48} className="opacity-20" />
                      <p className="mt-2">Start a new conversation</p>
                    </div>
                  )}
                  {messages.map((msg) => {
                    const isUser = msg.role === "user";
                    return (
                      <div key={msg.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                            isUser
                              ? "bg-blue-600/30 text-white"
                              : "bg-white/10 text-gray-200 border border-white/5"
                          )}
                        >
                          {isUser ? (
                            msg.content
                          ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {isLoading && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Input */}
                <div className="border-t border-white/10 bg-black/30 backdrop-blur-sm p-3">
                  <div className="flex items-end gap-2 max-w-4xl mx-auto">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (input.trim()) sendMessage(input);
                        }
                      }}
                      placeholder="Message Vatsa AI..."
                      rows={1}
                      className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-500"
                      style={{ minHeight: "44px", maxHeight: "120px", overflow: "auto" }}
                    />
                    <button
                      onClick={() => input.trim() && sendMessage(input)}
                      disabled={!input.trim() || isLoading}
                      className="rounded-full bg-blue-600 p-2.5 text-white disabled:opacity-40 transition"
                    >
                      {isLoading ? <Loader className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Bottom: Code & Preview (if code panel is shown) ── */}
              {showCodePanel && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="h-1/2 border-t border-white/10"
                >
                  {/* Use the existing EditorLayout but we need to pass codeContent */}
                  {/* Since EditorLayout might be a full component, we'll wrap it */}
                  <EditorLayout codeContent={codeContent} />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}