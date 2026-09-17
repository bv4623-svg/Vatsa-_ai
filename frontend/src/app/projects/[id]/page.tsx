"use client";

import { use } from "react";
import { ProjectDetailContent } from "@/components/projects/ProjectDetailContent";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <main className="flex h-screen flex-col bg-background">
      <ProjectDetailContent projectId={id} />
    </main>
  );
}
