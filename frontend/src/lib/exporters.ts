import type { Chat } from "../types/chat";
import { useAppStore } from "@/stores/app-store";

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "conversation"
  );
}

function toMarkdown(chat: Chat) {
  const head = `# ${chat.title}\n\n_Exported ${new Date().toLocaleString()} · ${chat.messages.length} messages · model: ${chat.model}_\n\n---\n\n`;
  return (
    head +
    chat.messages
      .map(
        (m) =>
          `**${m.role === "user" ? "You" : "Vatsa AI"}** · ${new Date(
            m.createdAt,
          ).toLocaleString()}\n\n${m.content}\n`,
      )
      .join("\n---\n\n")
  );
}

function toText(chat: Chat) {
  return (
    `${chat.title}\n${"=".repeat(chat.title.length)}\n\n` +
    chat.messages
      .map(
        (m) =>
          `[${m.role === "user" ? "You" : "Vatsa AI"} · ${new Date(
            m.createdAt,
          ).toLocaleString()}]\n${m.content}\n`,
      )
      .join("\n")
  );
}

export function exportChat(chat: Chat, format: "md" | "txt" | "json" | "pdf") {
  const toast = (props: { type: "info" | "error" | "success" | "warning"; message: string }) =>
    useAppStore.getState().addToast(props);
  const base = slug(chat.title);
  if (format === "md") {
    download(`${base}.md`, toMarkdown(chat), "text/markdown");
  } else if (format === "txt") {
    download(`${base}.txt`, toText(chat), "text/plain");
  } else if (format === "json") {
    download(`${base}.json`, JSON.stringify(chat, null, 2), "application/json");
  } else {
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) {
      toast({ type: "info", message: "Allow pop-ups to export as PDF" });
      return;
    }
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(
      chat.title,
    )}</title><style>
      body{font-family:Inter,system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#111;line-height:1.7}
      h1{font-size:26px;margin-bottom:4px}
      .meta{color:#777;font-size:12px;margin-bottom:32px}
      .m{margin:0 0 26px;padding-bottom:22px;border-bottom:1px solid #eee}
      .r{font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#666;margin-bottom:8px}
      pre{white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:13px;background:#f6f6f7;padding:12px;border-radius:8px}
    </style></head><body>
      <h1>${esc(chat.title)}</h1>
      <div class="meta">${chat.messages.length} messages · exported ${new Date().toLocaleString()}</div>
      ${chat.messages
        .map(
          (m) =>
            `<div class="m"><div class="r">${
              m.role === "user" ? "You" : "Vatsa AI"
            }</div><pre>${esc(m.content)}</pre></div>`,
        )
        .join("")}
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  }
  toast({ type: "success", message: `Exported as ${format.toUpperCase()}` });
}
