"use server";

import { revalidatePath } from "next/cache";

import { ESSAY_CATEGORIES } from "@/lib/essay-category";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }
  return { supabase, userId: user.id };
}

function value(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

export async function addEssay(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const question = value(formData, "question");
  if (!question) return { ok: false, message: "문항을 입력해 주세요." };

  const category = value(formData, "category");
  if (category && !ESSAY_CATEGORIES.includes(category as never)) {
    return { ok: false, message: "문항 유형이 올바르지 않습니다." };
  }

  const charLimitRaw = value(formData, "char_limit");
  const charLimit = charLimitRaw ? Number.parseInt(charLimitRaw, 10) : null;
  if (charLimit !== null && (Number.isNaN(charLimit) || charLimit < 1)) {
    return { ok: false, message: "글자 수 제한은 1 이상의 숫자여야 합니다." };
  }

  const { error } = await supabase.from("essays").insert({
    user_id: userId,
    application_id: value(formData, "application_id"),
    question,
    char_limit: charLimit,
    category,
    answer: value(formData, "answer"),
    is_final: value(formData, "state") === "최종",
  });

  if (error) {
    console.error("[library] 자소서 저장 실패", error.message);
    return { ok: false, message: "저장하지 못했습니다. 입력값을 확인해 주세요." };
  }

  revalidatePath("/library");
  return { ok: true, message: "저장했습니다." };
}

/** 초안 <-> 최종 전환 */
export async function toggleEssayFinal(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "") === "true";
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await supabase
    .from("essays")
    .update({ is_final: next })
    .eq("id", id);

  if (error) {
    console.error("[library] 상태 변경 실패", error.message);
  }

  revalidatePath("/library");
}

export async function removeEssay(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await supabase.from("essays").delete().eq("id", id);
  if (error) {
    console.error("[library] 삭제 실패", error.message);
  }

  revalidatePath("/library");
}

export async function updateEssay(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "잘못된 요청입니다." };

  const question = value(formData, "question");
  if (!question) return { ok: false, message: "문항을 입력해 주세요." };

  const category = value(formData, "category");
  if (category && !ESSAY_CATEGORIES.includes(category as never)) {
    return { ok: false, message: "문항 유형이 올바르지 않습니다." };
  }

  const charLimitRaw = value(formData, "char_limit");
  const charLimit = charLimitRaw ? Number.parseInt(charLimitRaw, 10) : null;
  if (charLimit !== null && (Number.isNaN(charLimit) || charLimit < 1)) {
    return { ok: false, message: "글자 수 제한은 1 이상의 숫자여야 합니다." };
  }

  const { error } = await supabase
    .from("essays")
    .update({
      application_id: value(formData, "application_id"),
      question,
      char_limit: charLimit,
      category,
      answer: value(formData, "answer"),
      is_final: value(formData, "state") === "최종",
    })
    .eq("id", id);

  if (error) {
    console.error("[library] 수정 실패", error.message);
    return { ok: false, message: "저장하지 못했습니다. 입력값을 확인해 주세요." };
  }

  revalidatePath("/library");
  return { ok: true, message: "수정했습니다." };
}
