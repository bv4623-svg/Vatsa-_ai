"use client";

import { useLibraryPage } from "@/hooks/library/useLibraryPage";
import { downloadItem } from "@/lib/library-client";
import { LibraryStorageBar } from "./LibraryStorageBar";
import { LibraryTabs } from "./LibraryTabs";
import { LibraryToolbar } from "./LibraryToolbar";
import { LibraryBreadcrumb } from "./LibraryBreadcrumb";
import { LibraryBulkBar } from "./LibraryBulkBar";
import { LibraryItemsView } from "./LibraryItemsView";
import { LibraryLoadMore } from "./LibraryLoadMore";
import { LibraryPreviewPanel } from "./LibraryPreviewPanel";
import { LibraryFolderModal } from "./LibraryFolderModal";
import { LibraryRenameModal } from "./LibraryRenameModal";
import { LibraryDeleteConfirm } from "./LibraryDeleteConfirm";
import { LibraryShareModal } from "./LibraryShareModal";
import type { LibraryItemActions } from "./LibraryItemMenu";

export function LibraryContent() {
  const p = useLibraryPage();

  const actions: LibraryItemActions = {
    onRename: p.setRenameTarget,
    onDelete: p.setDeleteTarget,
    onDownload: (item) => void downloadItem(item.id, item.name),
    onShare: p.setShareTarget,
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <LibraryStorageBar usage={p.storage.usage} loading={p.storage.loading} />
        <LibraryTabs active={p.filters.activeType} onChange={p.filters.setActiveType} />
        <LibraryBreadcrumb path={p.folderPath} onNavigate={p.navigateBreadcrumb} />
        <LibraryToolbar
          search={p.filters.search}
          onSearchChange={p.filters.setSearch}
          sort={p.filters.sort}
          order={p.filters.order}
          onSortChange={p.filters.setSort}
          view={p.view}
          onViewChange={p.setView}
          onCreateFolder={() => p.setFolderModalOpen(true)}
        />
        <LibraryBulkBar
          count={p.selection.count}
          onClear={p.selection.clear}
          onDelete={() => p.setDeleteTarget(p.items.filter((i) => p.selection.selected.has(i.id)))}
          onDownload={p.handleBulkDownload}
        />

        {p.error && <p className="text-sm text-red-500">{p.error}</p>}

        <LibraryItemsView
          items={p.items}
          view={p.view}
          search={p.filters.search}
          selected={p.selection.selected}
          onToggleSelect={p.selection.toggle}
          onOpen={p.openItem}
          actions={actions}
        />
        <LibraryLoadMore hasMore={p.hasMore} loading={p.loading} onClick={p.loadMore} />
      </div>

      <LibraryPreviewPanel item={p.previewItem} onClose={() => p.setPreviewItem(null)} />

      <LibraryFolderModal open={p.folderModalOpen} onClose={() => p.setFolderModalOpen(false)} onCreate={p.handleCreateFolder} />
      <LibraryRenameModal item={p.renameTarget} onClose={() => p.setRenameTarget(null)} onRename={p.handleRename} />
      <LibraryDeleteConfirm item={p.deleteTarget} onClose={() => p.setDeleteTarget(null)} onConfirm={p.handleDeleteConfirmed} />
      <LibraryShareModal item={p.shareTarget} onClose={() => p.setShareTarget(null)} onChanged={p.refetch} />
    </div>
  );
}
