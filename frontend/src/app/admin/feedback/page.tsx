import type { Metadata } from "next";
import { FeedbackAdmin } from "@/components/feedback/FeedbackAdmin";

export const metadata: Metadata = {
  title: "Feedback",
  robots: { index: false, follow: false },
};

export default function AdminFeedbackPage() {
  return <FeedbackAdmin />;
}
