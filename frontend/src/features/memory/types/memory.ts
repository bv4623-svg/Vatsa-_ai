export type MemoryType = "permanent" | "project" | "temporary";

export interface Memory {
  id: number;
  type: MemoryType;
  category: string | null;
  content: string;
  source: string | null;
  confidence: number;
  project_id: number | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryQuery {
  type?: string;
  category?: string;
}
