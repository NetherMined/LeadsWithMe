// src/types/export.ts
export interface ExportRecord {
  id: string;
  user_id: string;
  type: "sheets" | "docs" | "drive" | "pdf";
  google_file_id: string | null;
  google_file_url: string | null;
  business_ids: string[];
  created_at: string;
}