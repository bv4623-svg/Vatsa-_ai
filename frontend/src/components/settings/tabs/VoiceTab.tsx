"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { speak } from "@/lib/voice/tts";
import { useAppStore, useSettings } from "@/stores/app-store";

export const ASSISTANT_VOICES = ["Amy", "Brian", "Emma", "James", "Sofia"] as const;

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn("h-6 w-11 shrink-0 rounded-full p-1 transition", checked ? "bg-accent-solid" : "bg-zinc-300 dark:bg-zinc-700")}
      >
        <span className={cn("block h-4 w-4 rounded-full bg-white transition", checked && "translate-x-5")} />
      </button>
    </div>
  );
}

/** Settings -> Voice. Reads and writes the same app-store settings the chat
 * page reads (voiceInput, assistantVoice, autoRead), on this device. */
export function VoiceTab() {
  const settings = useSettings() as { voiceInput?: boolean; assistantVoice?: string; autoRead?: boolean };
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [unsupported, setUnsupported] = useState(false);
  const voice = typeof settings.assistantVoice === "string" && settings.assistantVoice ? settings.assistantVoice : "Emma";

  return (
    <div className="space-y-6">
      <Toggle
        label="Voice input"
        desc="Show the voice buttons (dictation and Talk) in the chat composer."
        checked={settings.voiceInput !== false}
        onChange={(v) => updateSettings({ voiceInput: v })}
      />
      <div>
        <label htmlFor="assistant-voice" className="text-sm font-medium text-foreground">Assistant voice</label>
        <p className="mt-0.5 text-xs text-muted-foreground">Used when replies are read aloud. Your browser provides the voices, so they vary by device.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            id="assistant-voice"
            value={voice}
            onChange={(e) => updateSettings({ assistantVoice: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            {ASSISTANT_VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setUnsupported(!speak(`Hi, this is ${voice} from Vatsa AI.`, { voiceLabel: voice }))}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/10"
          >
            Play sample
          </button>
        </div>
        {unsupported && <p role="alert" className="mt-2 text-xs text-destructive">Read-aloud isn&apos;t available in this browser.</p>}
      </div>
      <Toggle
        label="Auto read replies"
        desc="Speak each new reply as soon as it finishes. Voice is a Pro feature."
        checked={settings.autoRead === true}
        onChange={(v) => updateSettings({ autoRead: v })}
      />
    </div>
  );
}
