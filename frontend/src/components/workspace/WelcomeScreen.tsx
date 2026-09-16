"use client";

import { useState } from "react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useChat } from "@/hooks/useChat";

export default function WelcomeScreen() {
  const [prompt, setPrompt] = useState("");
  const { sendMessage, loading: isLoading } = useChat();
  const { setMode } = useWorkspaceStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setMode("building");
    await sendMessage(prompt);
    // After response, mode will be set to 'editor' via WebSocket or API callback.
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-3xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-2">What do you want to build?</h1>
      <p className="text-gray-400 mb-8">AI will generate a full project for you.</p>
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="E.g. Build a Spotify clone with React and Tailwind..."
            className="w-full h-32 p-4 bg-gray-900 border border-gray-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="absolute bottom-4 right-4 px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Thinking..." : "Generate →"}
          </button>
        </div>
      </form>
      <div className="flex gap-3 mt-6 flex-wrap justify-center">
        <button className="px-4 py-2 bg-gray-800 rounded-full text-sm hover:bg-gray-700">Todo App</button>
        <button className="px-4 py-2 bg-gray-800 rounded-full text-sm hover:bg-gray-700">E-commerce UI</button>
        <button className="px-4 py-2 bg-gray-800 rounded-full text-sm hover:bg-gray-700">Dashboard</button>
      </div>
    </div>
  );
}