/** Mirrors Backend app/models/scheduled_task.py's to_dict() exactly. */

export type ScheduledTaskStatus = "active" | "paused";

export interface ScheduledTask {
  id: string;
  userId: number;
  title: string;
  prompt: string;
  schedule: string;
  timezone: string;
  model: string | null;
  notifyEmail: boolean;
  status: ScheduledTaskStatus;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastResultId: string | null;
  createdAt: string;
}

export interface ScheduledTasksPage {
  items: ScheduledTask[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

/** Client-side building blocks for the create/edit form's schedule
 * builder -- these are never sent to the backend directly, only the cron
 * string + timezone they compile to. */
export type ScheduleFrequency = "hourly" | "daily" | "weekly";

export interface ScheduleDraft {
  frequency: ScheduleFrequency;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday, matches JS Date#getDay()
}
