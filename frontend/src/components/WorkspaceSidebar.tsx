"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { AIIcon } from "@/components/brand/AIIcon";
import {
  Home,
  MessageSquare,
  Code,
  Folder,
  Bot,
  BookOpen,
  File,
  CheckSquare,
  Brain,
  Clock,
  Settings,
  CreditCard,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { slug: "", label: "Home", icon: Home },
  { slug: "chats", label: "Chats", icon: MessageSquare },
  { slug: "code", label: "Code Workspace", icon: Code },
  { slug: "projects", label: "Projects", icon: Folder },
  { slug: "agents", label: "Agents", icon: Bot },
  { slug: "knowledge", label: "Knowledge", icon: BookOpen },
  { slug: "files", label: "Files", icon: File },
  { slug: "tasks", label: "Tasks", icon: CheckSquare },
  { slug: "memories", label: "Memories", icon: Brain },
  { slug: "history", label: "History", icon: Clock },
  { slug: "settings", label: "Settings", icon: Settings },
  { slug: "billing", label: "Billing", icon: CreditCard },
];

export default function WorkspaceSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const current = pathname.split("/").pop() || "";

  return (
    <motion.aside
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col h-full bg-black/40 backdrop-blur-xl border-r border-white/10 relative"
    >
      {/* Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-blue-600 border border-white/20 flex items-center justify-center text-white shadow-lg hover:scale-105 transition"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-white/5">
        <AIIcon size={32} />
        {!collapsed && <span className="text-white font-bold text-lg">Vatsa AI</span>}
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-gray-400 text-sm">
          <Search size={16} />
          {!collapsed && <span>Search (⌘K)</span>}
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {navItems.map((item) => {
          const isActive = current === item.slug || (item.slug === "" && current === "");
          const Icon = item.icon;
          return (
            <Link
              key={item.slug}
              href={`/workspace/${item.slug}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                isActive
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-500/10"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={20} />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/5 p-3">
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-gray-400 text-sm">
          <Settings size={18} />
          {!collapsed && <span>Preferences</span>}
        </button>
      </div>
    </motion.aside>
  );
}