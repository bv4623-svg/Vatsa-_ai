"use client";

import { useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import { LogOut, User, Settings } from "lucide-react";

export function ProfileMenu({
  collapsed = false,
  onOpenSettings,
}: {
  collapsed?: boolean;
  onOpenSettings: () => void;
}) {
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("relative", collapsed && "flex justify-center")}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors w-full",
          collapsed && "justify-center"
        )}
      >
        <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-medium shrink-0">
          {user?.name?.[0]?.toUpperCase() || "U"}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm text-zinc-100 truncate">{user?.name || "User"}</div>
              <div className="text-xs text-zinc-500 truncate">{user?.email || "user@vatsa.ai"}</div>
            </div>
            <Settings className="w-3.5 h-3.5 text-zinc-400" />
          </>
        )}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1 z-50">
          <button
            onClick={() => { logout(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-zinc-800"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}