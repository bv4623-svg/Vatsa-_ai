"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Background from "@/components/landing/Background";
import Magnetic from "@/components/landing/Magnetic";
import { Code, BookOpen, Palette, Image, Video, Database, Cpu, Settings, User } from "lucide-react";

const workspaceItems = [
  { slug: "code", label: "Code", icon: Code },
  { slug: "research", label: "Research", icon: BookOpen },
  { slug: "design", label: "Design", icon: Palette },
  { slug: "image", label: "Image", icon: Image },
  { slug: "video", label: "Video", icon: Video },
  { slug: "data", label: "Data", icon: Database },
  { slug: "automation", label: "Automation", icon: Cpu },
];

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = pathname.split("/").pop() || "code";

  return (
    <div className="relative min-h-screen">
      {/* Background – sab pages pe automatically */}
      <Background />
      
      <div className="relative z-10 flex h-screen overflow-hidden">
        {/* Activity Bar */}
        <aside className="flex flex-col items-center w-16 bg-black/40 backdrop-blur-md border-r border-white/10 py-4">
          <div className="flex-1 space-y-2">
            {workspaceItems.map((item) => {
              const isActive = current === item.slug;
              const Icon = item.icon;
              return (
                <Link
                  key={item.slug}
                  href={`/workspace/${item.slug}`}
                  className={`flex items-center justify-center w-12 h-12 mx-auto rounded-xl transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                      : "text-gray-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon size={22} />
                </Link>
              );
            })}
          </div>
          <div className="mt-auto space-y-2">
            <Link
              href="/settings"
              className="flex items-center justify-center w-12 h-12 mx-auto rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <Settings size={22} />
            </Link>
            <Link
              href="/profile"
              className="flex items-center justify-center w-12 h-12 mx-auto rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <User size={22} />
            </Link>
          </div>
        </aside>

        {/* Main Content – Magnetic effect automatically har interactive element pe */}
        <main className="flex-1 overflow-auto p-6 bg-black/20 backdrop-blur-sm">
          <Magnetic>
            <div className="max-w-7xl mx-auto">{children}</div>
          </Magnetic>
        </main>
      </div>
    </div>
  );
}