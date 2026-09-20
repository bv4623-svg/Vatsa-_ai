"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Code, MessageSquare, Sparkles, Plus, ArrowRight } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useLocalHour } from "@/hooks/useLocalTime";
import Magnetic from "@/components/landing/Magnetic";

const templates = [
  { icon: Code, label: "React App", prompt: "Build a React app with TypeScript and Tailwind" },
  { icon: Sparkles, label: "Next.js App", prompt: "Create a Next.js app with App Router" },
  { icon: MessageSquare, label: "AI Chatbot", prompt: "Build an AI chatbot with function calling" },
  { icon: Code, label: "FastAPI Backend", prompt: "Create a FastAPI backend with PostgreSQL" },
];

export function WorkspaceHome({ onQuickStart }: { onQuickStart: (prompt: string) => void }) {
  const { recentChats, pinnedProjects, getRecentChats, getPinnedProjects } = useWorkspaceStore();
  const hour = useLocalHour();
  const greeting = hour === null ? "Welcome" : hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  useEffect(() => {
    getRecentChats();
    getPinnedProjects();
  }, [getRecentChats, getPinnedProjects]);

  return (
    <div className="h-full space-y-8 overflow-y-auto p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white">{greeting}, Developer</h1>
          <p className="mt-1 text-gray-400">Ready to build something amazing today?</p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div><p className="text-sm text-gray-400">Storage</p><p className="font-medium text-white">2.4 GB / 10 GB</p></div>
          <div><p className="text-sm text-gray-400">Usage</p><p className="font-medium text-white">342 tokens</p></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[{ icon: Plus, label: "New Project" }, { icon: MessageSquare, label: "New Chat" }, { icon: Code, label: "Continue Coding" }, { icon: Sparkles, label: "AI Suggestions" }].map(({ icon: Icon, label }) => (
          <Magnetic key={label}><button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-gray-300 transition hover:bg-white/10"><Icon size={18} />{label}</button></Magnetic>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur-md">
          <h2 className="mb-3 font-semibold text-white">Recent Chats</h2>
          <div className="space-y-2">{recentChats.length ? recentChats.slice(0, 4).map((chat) => <div key={chat.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/5"><MessageSquare size={16} className="text-gray-400" /><span className="flex-1 truncate text-sm text-gray-300">{chat.title}</span><span className="text-xs text-gray-500">{new Date(chat.updatedAt).toLocaleDateString()}</span></div>) : <p className="text-sm text-gray-500">No recent chats</p>}</div>
        </section>
        <section className="rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur-md">
          <h2 className="mb-3 font-semibold text-white">Pinned Projects</h2>
          <div className="space-y-2">{pinnedProjects.length ? pinnedProjects.slice(0, 4).map((project) => <div key={project.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/5"><Code size={16} className="text-gray-400" /><span className="flex-1 truncate text-sm text-gray-300">{project.name}</span><span className="text-xs text-gray-500">{project.files?.length || 0} files</span></div>) : <p className="text-sm text-gray-500">No pinned projects</p>}</div>
        </section>
      </div>

      <section>
        <h2 className="mb-3 font-semibold text-white">Quick Start</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{templates.map(({ icon: Icon, label, prompt }) => <motion.button key={label} whileHover={{ scale: 1.02 }} onClick={() => onQuickStart(prompt)} className="group rounded-xl border border-white/10 bg-black/30 p-4 text-left transition hover:border-white/20"><Icon size={24} className="mb-2 text-blue-400" /><p className="text-sm font-medium text-white">{label}</p><p className="mt-1 line-clamp-2 text-xs text-gray-400">{prompt}</p><span className="mt-3 flex items-center text-xs text-blue-400">Launch <ArrowRight size={12} className="ml-1" /></span></motion.button>)}</div>
      </section>
    </div>
  );
}
