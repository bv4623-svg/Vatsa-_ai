import type { Metadata } from "next";
import { LibraryHeader } from "@/components/library/LibraryHeader";
import { LibraryContent } from "@/components/library/LibraryContent";

export const metadata: Metadata = {
  title: "Library",
  description: "Every chat, code project, upload and generated file in one place, with real storage usage.",
};

export default function LibraryPage() {
  return (
    <main className="flex h-screen flex-col bg-background">
      <LibraryHeader />
      <LibraryContent />
    </main>
  );
}
