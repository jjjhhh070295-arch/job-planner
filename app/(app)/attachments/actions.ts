"use server";

import { revalidatePath } from "next/cache";

import {
  ALLOWED_MIME,
  ATTACHMENT_BUCKET,
  MAX_ATTACHMENT_BYTES,
  OWNER_COLUMN,
  SIGNED_URL_SECONDS,
} from "@/lib/attachments";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  return { supabase, userId: user.id };
}

function value(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

function ownerColumn(formData: FormData): string | null {
  const kind = String(formData.get("owner_kind") ?? "");
  return kind in OWNER_COLUMN
    ? OWNER_COLUMN[kind as keyof typeof OWNER_COLUMN]
    : null;
}

function revalidateAll() {
  revalidatePath("/profile");
  revalidatePath("/applications");
}

/** 브라우저가 파일을 올린 뒤, 그 경로를 기록한다. */
export async function createFileAttachment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const column = ownerColumn(formData);
  const ownerId = value(formData, "owner_id");
  if (!column || !ownerId) return { ok: false, message: "잘못된 요청입니다." };

  const label = value(formData, "label");
  const path = value(formData, "storage_path");
  if (!label || !path) return { ok: false, message: "잘못된 요청입니다." };

  // 남의 폴더 경로를 밀어 넣지 못하게 막는다.
  if (!path.startsWith(`${userId}/`)) {
    return { ok: false, message: "잘못된 파일 경로입니다." };
  }

  const mime = value(formData, "mime_type");
  if (!mime || !ALLOWED_MIME.includes(mime as never)) {
    return { ok: false, message: "PDF 와 이미지만 올릴 수 있습니다." };
  }

  const sizeRaw = value(formData, "size_bytes");
  const size = sizeRaw ? Number.parseInt(sizeRaw, 10) : null;
  if (size !== null && (Number.isNaN(size) || size > MAX_ATTACHMENT_BYTES)) {
    return { ok: false, message: "파일이 10MB 를 넘습니다." };
  }

  const { error } = await supabase.from("attachments").insert({
    user_id: userId,
    [column]: ownerId,
    kind: "file",
    label,
    storage_path: path,
    mime_type: mime,
    size_bytes: size,
  });

  if (error) {
    console.error("[attachments] 파일 첨부 실패", error.message);
    // 기록에 실패했으면 올라간 파일도 치운다. 안 그러면 주인 없는 파일이 남는다.
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
    return { ok: false, message: "첨부하지 못했습니다." };
  }

  revalidateAll();
  return { ok: true, message: "첨부했습니다." };
}

/** 파일 대신 링크만 저장한다 (구글 드라이브 등). */
export async function createLinkAttachment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const column = ownerColumn(formData);
  const ownerId = value(formData, "owner_id");
  if (!column || !ownerId) return { ok: false, message: "잘못된 요청입니다." };

  const label = value(formData, "label");
  if (!label) return { ok: false, message: "이름을 입력해 주세요." };

  const url = value(formData, "url");
  if (!url) return { ok: false, message: "링크를 입력해 주세요." };
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, message: "http:// 또는 https:// 로 시작해야 합니다." };
  }

  const { error } = await supabase.from("attachments").insert({
    user_id: userId,
    [column]: ownerId,
    kind: "link",
    label,
    url,
  });

  if (error) {
    console.error("[attachments] 링크 첨부 실패", error.message);
    return { ok: false, message: "첨부하지 못했습니다." };
  }

  revalidateAll();
  return { ok: true, message: "링크를 붙였습니다." };
}

export async function removeAttachment(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  // 파일이면 저장소에서도 지운다. RLS 가 남의 행은 못 읽게 막는다.
  const { data: row } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("attachments").delete().eq("id", id);
  if (error) {
    console.error("[attachments] 삭제 실패", error.message);
    return;
  }

  const path = (row as { storage_path: string | null } | null)?.storage_path;
  if (path) {
    const { error: storageError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .remove([path]);
    if (storageError) {
      console.error("[attachments] 파일 삭제 실패", storageError.message);
    }
  }

  revalidateAll();
}

/**
 * 볼 때마다 짧은 만료의 임시 링크를 새로 만든다 (CLAUDE.md 3장 3번).
 * 주소를 화면에 박아 두지 않으므로, 링크가 새어 나가도 1분이면 못 쓰게 된다.
 */
export async function getAttachmentUrl(id: string): Promise<string | null> {
  const { supabase } = await requireUser();

  const { data: row } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const path = (row as { storage_path: string | null } | null)?.storage_path;
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);

  if (error) {
    console.error("[attachments] 임시 링크 생성 실패", error.message);
    return null;
  }

  return data?.signedUrl ?? null;
}
