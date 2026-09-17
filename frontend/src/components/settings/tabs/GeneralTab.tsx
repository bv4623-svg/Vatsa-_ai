"use client";

import { cn } from "@/lib/utils";

export function GeneralTab({
  settings,
  updateSettings,
  onClearAllChats,
  onExportChats,
}: {
  settings: any;
  updateSettings: (updates: any) => void;
  onClearAllChats: () => void;
  onExportChats: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground">Font Size</label>
        <div className="flex gap-2 mt-1">
          {["small", "medium", "large"].map((size) => (
            <button
              key={size}
              onClick={() => updateSettings({ fontSize: size })}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-sm transition-colors",
                settings.fontSize === size ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted-foreground hover:bg-accent/5"
              )}
            >
              {size.charAt(0).toUpperCase() + size.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="pt-2 border-t border-border">
        <button
          onClick={() => { if (window.confirm("Delete all chats permanently?")) onClearAllChats(); }}
          className="text-sm text-red-500 hover:underline"
        >
          Clear All Chats
        </button>
      </div>
      <div>
        <button onClick={onExportChats} className="text-sm text-accent hover:underline">
          Export Chats (JSON)
        </button>
      </div>
    </div>
  );
}
