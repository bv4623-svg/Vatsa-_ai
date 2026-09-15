"use client";

import { useState, useRef } from "react";
import { Send, Plus, Sparkles } from "lucide-react";
import Magnetic from "@/components/landing/Magnetic";

export default function ChatPanel() {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user" as const, content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // TODO: Replace with your actual chat API
    setTimeout(() => {
      const mock = "I'm here to help you code! What would you like to build?";
      setMessages((prev) => [...prev, { role: "assistant", content: mock }]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full bg-black/30">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-sm font-medium text-gray-300">AI Assistant</span>
        <button className="p-1 rounded hover:bg-white/10">
          <Plus size={16} className="text-gray-400" />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-10">
            <Sparkles size={32} className="mx-auto mb-2 text-blue-400" />
            <p>Ask me anything about your code</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-white/10 text-gray-200 border border-white/5"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/10 text-gray-200 px-3 py-2 rounded-xl text-sm">
              <span className="animate-pulse">▸</span> Thinking...
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 p-2 border-t border-white/10">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask AI..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50"
        />
        <Magnetic>
          <button onClick={sendMessage} className="p-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition">
            <Send size={16} className="text-white" />
          </button>
        </Magnetic>
      </div>
    </div>
  );
}