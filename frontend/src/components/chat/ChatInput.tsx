// components/chat/ChatInput.tsx
"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { createConversation } from "@/services/chat";

export default function ChatInput() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendMessage = async () => {
    if (!user) {
      alert("Please log in to send messages");
      return;
    }

    const trimmed = message.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      await createConversation(trimmed);
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      console.error("Send failed:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  return (
    <div className="flex items-end gap-2 p-2 border-t border-white/10 bg-black/20">
      <textarea
        ref={textareaRef}
        rows={1}
        value={message}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={user ? "Type your message…" : "Log in to chat"}
        disabled={!user || isSending}
        className="flex-1 resize-none bg-white/5 text-white placeholder-white/40 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50"
        style={{ minHeight: "44px", maxHeight: "200px" }}
      />
      <button
        onClick={sendMessage}
        disabled={!user || isSending || !message.trim()}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white font-medium transition"
      >
        {isSending ? "Sending…" : "Send"}
      </button>
    </div>
  );
}