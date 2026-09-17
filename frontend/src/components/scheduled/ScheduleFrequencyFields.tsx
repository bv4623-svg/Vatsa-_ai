"use client";

import { WEEKDAYS, getSupportedTimezones } from "@/lib/scheduled-tasks-client";
import type { ScheduleDraft } from "@/types/scheduled-task";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];
const selectClass =
  "w-full rounded-lg border border-border bg-input/10 px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none";

interface ScheduleFrequencyFieldsProps {
  draft: ScheduleDraft;
  onChange: (draft: ScheduleDraft) => void;
  timezone: string;
  onTimezoneChange: (tz: string) => void;
}

export function ScheduleFrequencyFields({ draft, onChange, timezone, onTimezoneChange }: ScheduleFrequencyFieldsProps) {
  const timezones = getSupportedTimezones();

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Frequency</label>
        <select
          value={draft.frequency}
          onChange={(e) => onChange({ ...draft, frequency: e.target.value as ScheduleDraft["frequency"] })}
          className={selectClass}
        >
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Timezone</label>
        <select value={timezone} onChange={(e) => onTimezoneChange(e.target.value)} className={selectClass}>
          {timezones.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      {draft.frequency === "weekly" && (
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Day of week</label>
          <select value={draft.weekday} onChange={(e) => onChange({ ...draft, weekday: Number(e.target.value) })} className={selectClass}>
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>{d.name}</option>
            ))}
          </select>
        </div>
      )}

      {draft.frequency !== "hourly" ? (
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Time</label>
          <div className="flex gap-2">
            <select value={draft.hour} onChange={(e) => onChange({ ...draft, hour: Number(e.target.value) })} className={selectClass}>
              {HOURS.map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}</option>
              ))}
            </select>
            <select value={draft.minute} onChange={(e) => onChange({ ...draft, minute: Number(e.target.value) })} className={selectClass}>
              {MINUTES.map((m) => (
                <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Minute</label>
          <select value={draft.minute} onChange={(e) => onChange({ ...draft, minute: Number(e.target.value) })} className={selectClass}>
            {MINUTES.map((m) => (
              <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
