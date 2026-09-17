"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { IconBtn } from "@/components/home/IconBtn";

interface SidebarNavLinkProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  collapsed?: boolean;
}

/** One real, working sidebar entry -- shared by the chat and code
 * sidebars so Library/Scheduled/Projects only need to be built once and
 * look identical in both places. */
export function SidebarNavLink({ href, label, icon, collapsed }: SidebarNavLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const active = pathname === href || pathname?.startsWith(`${href}/`);

  if (collapsed) {
    return (
      <IconBtn tip={label} side="right" className="h-9 w-9" onClick={() => router.push(href)}>
        {icon}
      </IconBtn>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        active ? "bg-accent/10 text-foreground" : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
