"use client";

import { Clock, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarNavLink } from "./SidebarNavLink";

/** Cross-cutting sections (not chat- or code-specific) shown identically
 * in both the chat and code sidebars, between the recent-items list and
 * the account footer, in this fixed order: Scheduled, Library, Projects.
 * Projects joins this list once its route is real. */
export function SidebarWorkspaceLinks({ collapsed }: { collapsed: boolean }) {
  const iconSize = collapsed ? "h-4 w-4" : "h-4 w-4";
  return (
    <nav
      aria-label="Workspace"
      className={cn("flex border-t border-border/60 py-2", collapsed ? "flex-col items-center gap-1 px-2" : "flex-col gap-0.5 px-2")}
    >
      <SidebarNavLink href="/scheduled" label="Scheduled" icon={<Clock className={iconSize} aria-hidden="true" />} collapsed={collapsed} />
      <SidebarNavLink href="/library" label="Library" icon={<FolderOpen className={iconSize} aria-hidden="true" />} collapsed={collapsed} />
    </nav>
  );
}
