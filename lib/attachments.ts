export const ATTACHMENT_BUCKET = "attachments";

/** 10MB. storage.buckets 의 file_size_limit 과 같은 값이어야 한다. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** 임시 링크 유효 시간(초). 짧게 둬서 링크가 새어 나가도 오래 못 쓰게 한다. */
export const SIGNED_URL_SECONDS = 60;

export type AttachmentOwner =
  | { kind: "spec"; id: string }
  | { kind: "experience"; id: string }
  | { kind: "application"; id: string };

export const OWNER_COLUMN = {
  spec: "spec_id",
  experience: "experience_id",
  application: "application_id",
} as const;

export type AttachmentRow = {
  id: string;
  kind: "file" | "link";
  label: string;
  storage_path: string | null;
  url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
};

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
