import type { Metadata } from "next";
import { ScheduledHeader } from "@/components/scheduled/ScheduledHeader";
import { ScheduledContent } from "@/components/scheduled/ScheduledContent";

export const metadata: Metadata = {
  title: "Scheduled Tasks",
  description: "Prompts that run automatically on a schedule you choose, with results saved to your Library.",
};

export default function ScheduledTasksPage() {
  return (
    <main className="flex h-screen flex-col bg-background">
      <ScheduledHeader />
      <ScheduledContent />
    </main>
  );
}
