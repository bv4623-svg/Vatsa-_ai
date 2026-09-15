import type { Message } from "@/types";

export function ChatMessage({ message }: { message: Message }) {
  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
      <div className="text-sm text-white">{message.content}</div>
    </div>
  );
}
