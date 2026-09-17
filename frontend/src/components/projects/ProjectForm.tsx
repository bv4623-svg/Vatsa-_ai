"use client";

import { useState } from "react";
import type { CreateProjectInput } from "@/lib/chat-projects-client";
import type { ChatProject } from "@/types/chat-project";

const fieldClass =
  "w-full rounded-lg border border-border bg-input/10 px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none";

interface ProjectFormProps {
  project: ChatProject | null;
  onClose: () => void;
  onSubmit: (input: CreateProjectInput) => Promise<void> | void;
}

/** Keyed by project?.id at the call site (ProjectFormModal), so switching
 * between "new" and editing a different project remounts this form with
 * fresh initial state instead of syncing via an effect. */
export function ProjectForm({ project, onClose, onSubmit }: ProjectFormProps) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(project?.systemPrompt ?? "");
  const [instructions, setInstructions] = useState(project?.instructions ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        systemPrompt: systemPrompt.trim() || null,
        instructions: instructions.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor="project-name" className="mb-1 block text-xs text-muted-foreground">Name</label>
        <input id="project-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Marketing Copy" className={fieldClass} />
      </div>

      <div>
        <label htmlFor="project-description" className="mb-1 block text-xs text-muted-foreground">Description</label>
        <input id="project-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this project is for" className={fieldClass} />
      </div>

      <div>
        <label htmlFor="project-system-prompt" className="mb-1 block text-xs text-muted-foreground">System prompt</label>
        <textarea
          id="project-system-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={2}
          placeholder="How should Vatsa AI behave in every chat in this project?"
          className={`${fieldClass} resize-none`}
        />
      </div>

      <div>
        <label htmlFor="project-instructions" className="mb-1 block text-xs text-muted-foreground">Instructions</label>
        <textarea
          id="project-instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder="Standing instructions applied to every reply in this project"
          className={`${fieldClass} resize-none`}
        />
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent/10">Cancel</button>
        <button onClick={submit} disabled={!name.trim() || saving} className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-foreground disabled:opacity-50">
          {saving ? "Saving..." : project ? "Save changes" : "Create project"}
        </button>
      </div>
    </div>
  );
}
