"use client";

import { useState } from "react";
import { draftToCron, cronToDraft, describeSchedule } from "@/lib/scheduled-tasks-client";
import { ScheduleFrequencyFields } from "./ScheduleFrequencyFields";
import { ScheduledTaskOptions } from "./ScheduledTaskOptions";
import type { CreateTaskInput } from "@/lib/scheduled-tasks-client";
import type { ScheduledTask, ScheduleDraft } from "@/types/scheduled-task";

const fieldClass =
  "w-full rounded-lg border border-border bg-input/10 px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none";

interface ScheduledTaskFormProps {
  task: ScheduledTask | null;
  defaultTimezone: string;
  onClose: () => void;
  onSubmit: (input: CreateTaskInput) => Promise<void> | void;
}

/** Keyed by task?.id at the call site (ScheduledTaskModal), so switching
 * between "new" and editing a different task remounts this form with
 * fresh initial state instead of syncing via an effect. */
export function ScheduledTaskForm({ task, defaultTimezone, onClose, onSubmit }: ScheduledTaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [prompt, setPrompt] = useState(task?.prompt ?? "");
  const [draft, setDraft] = useState<ScheduleDraft>(
    task ? cronToDraft(task.schedule) : { frequency: "daily", hour: 9, minute: 0, weekday: 1 }
  );
  const [timezone, setTimezone] = useState(task?.timezone ?? defaultTimezone);
  const [model, setModel] = useState(task?.model ?? "");
  const [notifyEmail, setNotifyEmail] = useState(task?.notifyEmail ?? false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || !prompt.trim() || saving) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        prompt: prompt.trim(),
        schedule: draftToCron(draft),
        timezone,
        model: model || null,
        notifyEmail,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor="task-title" className="mb-1 block text-xs text-muted-foreground">Title</label>
        <input
          id="task-title"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Daily standup summary"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="task-prompt" className="mb-1 block text-xs text-muted-foreground">Prompt</label>
        <textarea
          id="task-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="What should Vatsa AI do each time this runs?"
          className={`${fieldClass} resize-none`}
        />
      </div>

      <ScheduleFrequencyFields draft={draft} onChange={setDraft} timezone={timezone} onTimezoneChange={setTimezone} />
      <p className="text-xs text-muted-foreground">{describeSchedule(draft)} ({timezone})</p>

      <ScheduledTaskOptions model={model} onModelChange={setModel} notifyEmail={notifyEmail} onNotifyEmailChange={setNotifyEmail} />

      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent/10">Cancel</button>
        <button
          onClick={submit}
          disabled={!title.trim() || !prompt.trim() || saving}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-foreground disabled:opacity-50"
        >
          {saving ? "Saving..." : task ? "Save changes" : "Create task"}
        </button>
      </div>
    </div>
  );
}
