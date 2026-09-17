"use client";

import { useState } from "react";
import type { UpdateProjectInput } from "@/lib/chat-projects-client";
import type { ChatProject } from "@/types/chat-project";

const fieldClass =
  "w-full rounded-lg border border-border bg-input/10 px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none";

interface ProjectSettingsFormProps {
  project: ChatProject;
  onSave: (patch: UpdateProjectInput) => Promise<void> | void;
}

/** Keyed by project.id at the call site (ProjectSettingsTab), so a fresh
 * project remounts this form with correct initial values instead of
 * syncing via an effect. */
export function ProjectSettingsForm({ project, onSave }: ProjectSettingsFormProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(project.systemPrompt ?? "");
  const [instructions, setInstructions] = useState(project.instructions ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        systemPrompt: systemPrompt.trim() || null,
        instructions: instructions.trim() || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <div>
        <label htmlFor="settings-name" className="mb-1 block text-xs text-muted-foreground">Name</label>
        <input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
      </div>

      <div>
        <label htmlFor="settings-description" className="mb-1 block text-xs text-muted-foreground">Description</label>
        <input id="settings-description" value={description} onChange={(e) => setDescription(e.target.value)} className={fieldClass} />
      </div>

      <div>
        <label htmlFor="settings-system-prompt" className="mb-1 block text-xs text-muted-foreground">System prompt</label>
        <textarea id="settings-system-prompt" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={2} className={`${fieldClass} resize-none`} />
      </div>

      <div>
        <label htmlFor="settings-instructions" className="mb-1 block text-xs text-muted-foreground">Instructions</label>
        <textarea id="settings-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} className={`${fieldClass} resize-none`} />
        <p className="mt-1 text-xs text-muted-foreground">Applied to every reply in every chat inside this project.</p>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={!name.trim() || saving} className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-foreground disabled:opacity-50">
          {saving ? "Saving..." : "Save"}
        </button>
        {saved && <span className="text-xs text-green-500">Saved</span>}
      </div>
    </div>
  );
}
