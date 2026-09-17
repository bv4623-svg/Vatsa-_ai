"use client";

import { ThemeSwitcher } from "@/components/settings/ThemeSwitcher";

export function AppearanceTab({
  settings,
  updateSettings,
}: {
  settings: any;
  updateSettings: (updates: any) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground">Theme</label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Applies instantly and follows you across devices.
        </p>
        <div className="mt-2">
          <ThemeSwitcher onChange={(theme) => updateSettings({ theme })} />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">Accent Color</label>
        <div className="flex gap-2 mt-1">
          {["default", "blue", "purple", "green", "orange"].map((color) => (
            <button
              key={color}
              onClick={() => updateSettings({ accentColor: color })}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                settings.accentColor === color ? "border-accent scale-110" : "border-transparent"
              }`}
              style={{ background: color === "default" ? "#a855f7" : color === "blue" ? "#3b82f6" : color === "purple" ? "#a855f7" : color === "green" ? "#10b981" : "#f97316" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
