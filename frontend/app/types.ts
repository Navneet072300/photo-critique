export interface Critique {
  composition: string;
  exposure: string;
}

export type PhotoStatus = "pending" | "processing" | "done" | "error";

export interface Photo {
  id: number;
  filename: string;
  original_filename: string;
  created_at: string;
  status: PhotoStatus;
  error_message: string | null;
  critique: Critique | null;
  tags: string[];
}

export interface Tag {
  name: string;
  count: number;
}
