/** Mirrors Backend app/models/chat_project.py's to_public_dict() exactly.
 * Named ChatProject (not Project) to avoid colliding with the unrelated,
 * pre-existing code-workspace Project type in stores/workspaceStore.ts. */
export interface ChatProject {
  id: string;
  userId: number;
  name: string;
  description: string | null;
  systemPrompt: string | null;
  instructions: string | null;
  archived: boolean;
  createdAt: string;
  chatIds: string[];
  fileIds: string[];
}
