"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth/current-user";
import type { FormState } from "@/lib/form-state";
import { SHARED_RESULTS } from "@/lib/shared-essay";
import { createAdminClient, isAdminUsername } from "@/lib/supabase/admin";

/* ============================================================
   공용 자소서는 관리자만 쓴다.

   shared_essays 에는 추가·수정·삭제 정책이 없어서 RLS 가 전부 막는다.
   그래서 여기서만 service_role 키로 지나가고, 그 전에 관리자인지 확인한다.
   ============================================================ */

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || !isAdminUsername(profile.username)) {
    throw new Error("권한이 없습니다.");
  }
  return { admin: createAdminClient(), userId: profile.userId };
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullable(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value ? value : null;
}

/** 공개 범위와 동의 체크를 함께 검사한다. DB 에도 같은 제약이 걸려 있다. */
function readVisibility(formData: FormData): {
  visibility: string;
  consent: boolean;
  error?: string;
} {
  const consent = formData.get("consent_confirmed") === "on";
  const visibility = text(formData, "visibility") === "all" ? "all" : "admin";

  if (visibility === "all" && !consent) {
    return {
      visibility,
      consent,
      error: "전체 공개는 작성자 동의를 받은 경우에만 가능합니다.",
    };
  }
  return { visibility, consent };
}

/* ------------------------------------------------------------
   여러 문항을 한 번에 저장한다 (붙여넣기·파일 올리기 결과)
   ------------------------------------------------------------ */
export async function saveSharedEssays(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { admin, userId } = await requireAdmin();

  const company = text(formData, "company");
  if (!company) return { ok: false, message: "기업을 적어 주세요." };

  const resultValue = text(formData, "result");
  const result = (SHARED_RESULTS as readonly string[]).includes(resultValue)
    ? resultValue
    : "모름";

  const { visibility, consent, error } = readVisibility(formData);
  if (error) return { ok: false, message: error };

  // 미리보기 화면이 보낸 문항 묶음. 화면에서 고친 내용이 그대로 온다.
  let items: {
    question: string;
    answer: string;
    charLimit: number | null;
    category: string | null;
  }[];
  try {
    items = JSON.parse(text(formData, "items"));
  } catch {
    return { ok: false, message: "보낸 내용을 읽지 못했습니다." };
  }

  const rows = items
    .filter((item) => item.question?.trim() && item.answer?.trim())
    .map((item) => ({
      company,
      role: nullable(formData, "role"),
      season: nullable(formData, "season"),
      question: item.question.trim().slice(0, 500),
      answer: item.answer.trim().slice(0, 20000),
      char_limit:
        typeof item.charLimit === "number" && item.charLimit > 0
          ? item.charLimit
          : null,
      category: item.category?.trim() || null,
      result,
      source_memo: nullable(formData, "source_memo"),
      consent_confirmed: consent,
      visibility,
      created_by: userId,
    }));

  if (rows.length === 0) {
    return { ok: false, message: "저장할 문항이 없습니다. 문항과 답변을 채워 주세요." };
  }

  const { error: insertError } = await admin.from("shared_essays").insert(rows);
  if (insertError) {
    console.error("[shared-essays] 저장 실패", insertError.message);
    return { ok: false, message: `저장하지 못했습니다: ${insertError.message}` };
  }

  revalidatePath("/admin/shared-essays");
  revalidatePath("/library/shared");
  return { ok: true, message: `${rows.length}개 문항을 저장했습니다.` };
}

/* ------------------------------------------------------------
   한 건 수정
   ------------------------------------------------------------ */
export async function updateSharedEssay(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { admin } = await requireAdmin();

  const id = text(formData, "id");
  if (!id) return { ok: false, message: "잘못된 요청입니다." };

  const company = text(formData, "company");
  const question = text(formData, "question");
  const answer = text(formData, "answer");
  if (!company || !question || !answer) {
    return { ok: false, message: "기업·문항·답변은 비울 수 없습니다." };
  }

  const { visibility, consent, error } = readVisibility(formData);
  if (error) return { ok: false, message: error };

  const charLimitRaw = text(formData, "char_limit");
  const charLimit = charLimitRaw ? Number.parseInt(charLimitRaw, 10) : null;

  const resultValue = text(formData, "result");

  const { error: updateError } = await admin
    .from("shared_essays")
    .update({
      company,
      role: nullable(formData, "role"),
      season: nullable(formData, "season"),
      question,
      answer,
      char_limit:
        charLimit !== null && !Number.isNaN(charLimit) && charLimit > 0
          ? charLimit
          : null,
      category: nullable(formData, "category"),
      result: (SHARED_RESULTS as readonly string[]).includes(resultValue)
        ? resultValue
        : "모름",
      source_memo: nullable(formData, "source_memo"),
      consent_confirmed: consent,
      visibility,
    })
    .eq("id", id);

  if (updateError) {
    console.error("[shared-essays] 수정 실패", updateError.message);
    return { ok: false, message: `수정하지 못했습니다: ${updateError.message}` };
  }

  revalidatePath("/admin/shared-essays");
  revalidatePath("/library/shared");
  return { ok: true, message: "고쳤습니다." };
}

/* ------------------------------------------------------------
   한 건 삭제
   ------------------------------------------------------------ */
export async function removeSharedEssay(formData: FormData): Promise<void> {
  const { admin } = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await admin.from("shared_essays").delete().eq("id", id);
  if (error) console.error("[shared-essays] 삭제 실패", error.message);

  revalidatePath("/admin/shared-essays");
  revalidatePath("/library/shared");
}
