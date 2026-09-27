import { useState, useCallback } from "react";
import type { Attachment } from "@/types/home";
import type { Message } from "@/types";
import { API_BASE } from "@/lib/home/constants";
import { errorMessageFromBody } from "@/lib/home/attachments";
import { parseUpgradeGate, type UpgradeGateInfo } from "@/lib/billing/upgradeError";

interface UseVisionAnalysisParams {
  activeConversationId: string | null;
  handleNewChat: (onCreated?: () => void) => Promise<string | null>;
  addMessageToConversation: (convId: string, msg: Message) => void;
  setErrorState: (err: { message: string; stack?: string } | null) => void;
  onUpgradeRequired?: (info: UpgradeGateInfo) => void;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

function formatVisionResult(data: {
  description?: string;
  tags?: string[];
  extracted_text?: string;
}): string {
  const parts = [data.description || "No description available."];
  if (data.tags?.length) {
    parts.push(`\n**Tags:** ${data.tags.map((t) => `\`${t}\``).join(" ")}`);
  }
  if (data.extracted_text) {
    parts.push(`\n**Extracted text:**\n\`\`\`\n${data.extracted_text}\n\`\`\``);
  }
  return parts.join("\n");
}

/** Owns the "Analyze" action on image attachment chips: a one-shot call
 * to /api/vision/analyze, inserted as an assistant message. */
export function useVisionAnalysis({
  activeConversationId, handleNewChat, addMessageToConversation, setErrorState, onUpgradeRequired,
}: UseVisionAnalysisParams) {
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const analyzeImage = useCallback(async (file: Attachment) => {
    if (!file.content) return;
    setAnalyzingId(file.id);
    try {
      let convId = activeConversationId;
      if (!convId) {
        convId = await handleNewChat();
        if (!convId) throw new Error("Could not create a conversation");
      }

      const blob = await dataUrlToBlob(file.content);
      const form = new FormData();
      form.append("file", blob, file.name);

      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/api/vision/analyze`, {
        method: "POST",
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        body: form,
      });
      if (!res.ok) {
        // Free plan / daily limit: open the upgrade flow instead of showing
        // "[object Object]" (the gate's detail is an object, not a string).
        const gate = await parseUpgradeGate(res.clone());
        if (gate) {
          onUpgradeRequired?.(gate.info);
          return;
        }
        const body = await res.json().catch(() => null);
        throw new Error(errorMessageFromBody(body, res.status));
      }
      const data = await res.json();

      addMessageToConversation(convId, {
        id: `vision_${Date.now()}`,
        role: "assistant",
        content: formatVisionResult(data),
        createdAt: new Date().toISOString(),
        model: "Vatsa AI",
      });
      setErrorState(null);
    } catch (e: any) {
      setErrorState({ message: e.message || "Image analysis failed" });
    } finally {
      setAnalyzingId(null);
    }
  }, [activeConversationId, handleNewChat, addMessageToConversation, setErrorState, onUpgradeRequired]);

  return { analyzingId, analyzeImage };
}
