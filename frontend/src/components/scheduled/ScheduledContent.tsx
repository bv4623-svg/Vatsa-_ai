"use client";

import { Plus } from "lucide-react";
import { useUser } from "@/stores/auth";
import { useScheduledTasksPage } from "@/hooks/scheduled-tasks/useScheduledTasksPage";
import { ScheduledEmptyState } from "./ScheduledEmptyState";
import { ScheduledTaskList } from "./ScheduledTaskList";
import { ScheduledPagination } from "./ScheduledPagination";
import { ScheduledTaskModal } from "./ScheduledTaskModal";
import { ScheduledDeleteConfirm } from "./ScheduledDeleteConfirm";
import type { ScheduledTaskActions } from "./ScheduledTaskMenu";
import { ListStatus, showsEmpty } from "@/components/ui/list-status";

export function ScheduledContent() {
  const user = useUser();
  const timezone: string = user?.settings?.timezone || "UTC";
  const p = useScheduledTasksPage();

  const actions: ScheduledTaskActions = {
    onEdit: p.openEdit,
    onDelete: p.setDeleteTarget,
    onTogglePause: p.togglePause,
    onRunNow: p.runNow,
  };

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {p.total} scheduled task{p.total === 1 ? "" : "s"}
        </p>
        <button
          onClick={p.openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> New task
        </button>
      </div>

      <ListStatus loading={p.loading} error={p.error} count={p.tasks.length} onRetry={() => void p.refetch()} loadingLabel="Loading scheduled tasks…" />

      {showsEmpty({ loading: p.loading, error: p.error, count: p.tasks.length }) ? (
        <ScheduledEmptyState onCreate={p.openCreate} />
      ) : (
        <ScheduledTaskList tasks={p.tasks} viewerTimezone={timezone} runningId={p.runningId} actions={actions} />
      )}

      <ScheduledPagination page={p.page} pageSize={p.pageSize} total={p.total} hasMore={p.hasMore} onGoToPage={p.goToPage} />

      <ScheduledTaskModal open={p.formOpen} task={p.editingTask} defaultTimezone={timezone} onClose={p.closeForm} onSubmit={p.submitForm} />
      <ScheduledDeleteConfirm task={p.deleteTarget} onClose={() => p.setDeleteTarget(null)} onConfirm={p.confirmDelete} />
    </div>
  );
}
