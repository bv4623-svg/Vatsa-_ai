import type { Metadata } from "next";
import { ProjectsHeader } from "@/components/projects/ProjectsHeader";
import { ProjectsContent } from "@/components/projects/ProjectsContent";

export const metadata: Metadata = {
  title: "Projects",
  description: "Group chats and files under one system prompt and instructions.",
};

export default function ProjectsPage() {
  return (
    <main className="flex h-screen flex-col bg-background">
      <ProjectsHeader />
      <ProjectsContent />
    </main>
  );
}
