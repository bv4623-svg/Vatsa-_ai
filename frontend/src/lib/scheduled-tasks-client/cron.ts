import type { ScheduleDraft } from "@/types/scheduled-task";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const WEEKDAYS = WEEKDAY_NAMES.map((name, value) => ({ value, name }));

export function draftToCron(draft: ScheduleDraft): string {
  if (draft.frequency === "hourly") return `${draft.minute} * * * *`;
  if (draft.frequency === "weekly") return `${draft.minute} ${draft.hour} * * ${draft.weekday}`;
  return `${draft.minute} ${draft.hour} * * *`;
}

/** Best-effort inverse of draftToCron, for prefilling the edit form from a
 * saved cron string. Anything outside the three shapes the form itself
 * produces (e.g. a hand-edited every-15-minutes expression) falls back to
 * a sane daily default rather than guessing wrong. */
export function cronToDraft(cron: string): ScheduleDraft {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return { frequency: "daily", hour: 9, minute: 0, weekday: 1 };
  const [minute, hour, , , weekday] = parts;

  if (hour === "*") return { frequency: "hourly", hour: 0, minute: Number(minute) || 0, weekday: 1 };
  if (weekday !== "*") {
    return { frequency: "weekly", hour: Number(hour) || 0, minute: Number(minute) || 0, weekday: Number(weekday) || 0 };
  }
  return { frequency: "daily", hour: Number(hour) || 0, minute: Number(minute) || 0, weekday: 1 };
}

export function describeSchedule(draft: ScheduleDraft): string {
  const time = `${String(draft.hour).padStart(2, "0")}:${String(draft.minute).padStart(2, "0")}`;
  if (draft.frequency === "hourly") return `Every hour at :${String(draft.minute).padStart(2, "0")}`;
  if (draft.frequency === "weekly") return `Every ${WEEKDAY_NAMES[draft.weekday]} at ${time}`;
  return `Every day at ${time}`;
}
