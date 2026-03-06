export interface UploadedDocument {
  id: string;
  name: string;
  type: string;
  status: "ready" | "processing" | "error";
  chunkCount?: number;
  size?: number;
  error?: string;
  progress?: number;
}

export const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
];

export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".csv"];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export type ChatMode = "study" | "deepExplore";

export type SandboxStudyMode =
  | "concept-refresh"
  | "formula-drill"
  | "past-paper"
  | "flashcards"
  | "mistake-fix"
  | "compare-contrast"
  | "case-study"
  | "step-by-step";
