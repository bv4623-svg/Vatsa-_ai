import type { Metadata } from "next";
import { ChatFeedbackAdmin } from "@/components/feedback/ChatFeedbackAdmin";

export const metadata: Metadata = {
  title: "Chat ratings",
  robots: { index: false, follow: false },
};

export default function AdminChatFeedbackPage() {
  return <ChatFeedbackAdmin />;
}
