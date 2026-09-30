"use client";

import { Mic, MicOff, Telescope, Lock, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/home/Tooltip";

/** Everything the composer needs to render voice + research controls. */
export interface ComposerVoiceProps {
  /** Settings -> Voice -> voice input; off hides the voice buttons. */
  enabled: boolean;
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  onToggle: () => void;
  conversationMode: boolean;
  onToggleConversationMode: () => void;
  locked: boolean;
}

export interface ComposerResearchProps {
  enabled: boolean;
  onToggle: () => void;
  locked: boolean;
}

const pill = "tap-target relative flex items-center gap-1 rounded-full text-sm transition-colors hover:bg-accent/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

export function VoiceButton({ voice, compact }: { voice: ComposerVoiceProps; compact?: boolean }) {
  if (!voice.enabled) return null;
  const label = voice.locked
    ? "Voice is a Pro feature"
    : !voice.supported
    ? "Voice input isn't supported in this browser"
    : voice.listening
    ? "Stop dictation"
    : "Dictate with your voice";
  return (
    <Tooltip text={label}>
      <button
        type="button"
        onClick={voice.onToggle}
        aria-label={label}
        aria-pressed={voice.listening}
        disabled={!voice.locked && !voice.supported}
        className={cn(
          pill,
          compact ? "p-2" : "p-2 sm:px-3 sm:py-1.5",
          voice.listening ? "bg-red-500/20 text-red-400" : "bg-accent/5 text-foreground/75",
          "disabled:cursor-not-allowed disabled:opacity-40"
        )}
      >
        {voice.listening ? (
          <span className="relative flex h-4 w-4 items-center justify-center" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400/60" />
            <MicOff className="relative h-4 w-4" />
          </span>
        ) : (
          <Mic className="h-4 w-4" aria-hidden />
        )}
        {!compact && <span className="hidden sm:inline">{voice.listening ? "Listening" : "Voice"}</span>}
        {voice.locked && <Lock className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-background text-muted-foreground" aria-hidden />}
      </button>
    </Tooltip>
  );
}

export function VoiceConversationButton({ voice, compact }: { voice: ComposerVoiceProps; compact?: boolean }) {
  const label = voice.conversationMode
    ? "Voice conversation on: replies are read aloud and dictation sends automatically"
    : "Voice conversation: speak, auto-send, hear the reply";
  if (!voice.enabled || (!voice.supported && !voice.locked)) return null;
  return (
    <Tooltip text={voice.locked ? "Voice is a Pro feature" : label}>
      <button
        type="button"
        onClick={voice.onToggleConversationMode}
        aria-label={voice.locked ? "Voice conversation (Pro feature)" : label}
        aria-pressed={voice.conversationMode}
        className={cn(
          pill,
          compact ? "p-2" : "p-2 sm:px-3 sm:py-1.5",
          voice.conversationMode ? "bg-accent/20 text-purple-700 dark:text-purple-300" : "bg-accent/5 text-foreground/75"
        )}
      >
        <Headphones className="h-4 w-4" aria-hidden />
        {!compact && <span className="hidden sm:inline">Talk</span>}
      </button>
    </Tooltip>
  );
}

export function ResearchToggle({ research, compact }: { research: ComposerResearchProps; compact?: boolean }) {
  const label = research.locked
    ? "Deep research is a Business feature"
    : research.enabled
    ? "Deep research on: multi-step web research with a cited report"
    : "Deep research: multi-step web research with a cited report";
  return (
    <Tooltip text={label}>
      <button
        type="button"
        onClick={research.onToggle}
        aria-label={label}
        aria-pressed={research.enabled}
        className={cn(
          pill,
          compact ? "p-2" : "p-2 sm:px-3 sm:py-1.5",
          research.enabled ? "bg-accent/20 text-purple-700 dark:text-purple-300" : "bg-accent/5 text-foreground/75"
        )}
      >
        <Telescope className="h-4 w-4" aria-hidden />
        {!compact && <span className="hidden sm:inline">Research</span>}
        {research.locked && <Lock className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-background text-muted-foreground" aria-hidden />}
      </button>
    </Tooltip>
  );
}

/** Live transcript while listening, or the last voice error. */
export function VoiceStatus({ voice }: { voice: ComposerVoiceProps }) {
  if (voice.listening) {
    return (
      <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden />
        {voice.interim ? <span className="italic">{voice.interim}</span> : "Listening… speak now"}
      </p>
    );
  }
  if (voice.error) {
    return (
      <p className="mb-2 text-xs text-red-400" role="alert">
        {voice.error}
      </p>
    );
  }
  return null;
}
