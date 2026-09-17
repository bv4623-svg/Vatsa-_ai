"use client";

const MODEL_OPTIONS = [
  { value: "", label: "Auto (recommended)" },
  { value: "vatsa-fast", label: "Vatsa Fast" },
  { value: "vatsa-pro", label: "Vatsa Pro" },
  { value: "vatsa-advanced", label: "Vatsa Advanced" },
];
const fieldClass =
  "w-full rounded-lg border border-border bg-input/10 px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none";

interface ScheduledTaskOptionsProps {
  model: string;
  onModelChange: (model: string) => void;
  notifyEmail: boolean;
  onNotifyEmailChange: (notify: boolean) => void;
}

export function ScheduledTaskOptions({ model, onModelChange, notifyEmail, onNotifyEmailChange }: ScheduledTaskOptionsProps) {
  return (
    <>
      <div>
        <label htmlFor="task-model" className="mb-1 block text-xs text-muted-foreground">Model</label>
        <select id="task-model" value={model} onChange={(e) => onModelChange(e.target.value)} className={fieldClass}>
          {MODEL_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={notifyEmail}
          onChange={(e) => onNotifyEmailChange(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-accent"
        />
        Email me the result when this runs
      </label>
    </>
  );
}
