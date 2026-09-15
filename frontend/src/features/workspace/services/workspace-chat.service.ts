const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface WorkspaceChatResponse {
  response?: string;
  selected_model?: string;
}

export async function sendWorkspaceMessage(message: string): Promise<WorkspaceChatResponse> {
  const token = localStorage.getItem("access_token");
  const userId = localStorage.getItem("vatsa_user_id") || "anonymous";
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, user_id: userId, model: "auto" }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<WorkspaceChatResponse>;
}
