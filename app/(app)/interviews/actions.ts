"use server";

import { revalidatePath } from "next/cache";

import {
  INTERVIEW_FORMATS,
  INTERVIEW_RESULTS,
  QUESTION_CATEGORIES,
} from "@/lib/interview";
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

function revalidateAll(interviewId?: string) {
  revalidatePath("/interviews");
  if (interviewId) revalidatePath(`/interviews/${interviewId}`);
  revalidatePath("/library");
}

/* ---------------- 회차 ---------------- */

function readInterview(formData: FormData): Record<string, unknown> | string {
  const stage = value(formData, "stage");
  if (!stage) return "전형 차수를 입력해 주세요.";

  const format = value(formData, "format") ?? "대면";
  if (!INTERVIEW_FORMATS.includes(format as never)) {
    return "면접 방식이 올바르지 않습니다.";
  }

  const result = value(formData, "result") ?? "대기";
  if (!INTERVIEW_RESULTS.includes(result as never)) {
    return "결과 값이 올바르지 않습니다.";
  }

  const countRaw = value(formData, "interviewer_count");
  const count = countRaw ? Number.parseInt(countRaw, 10) : null;
  if (count !== null && (Number.isNaN(count) || count < 1 || count > 50)) {
    return "면접관 수는 1~50 사이로 넣어 주세요.";
  }

  return {
    application_id: value(formData, "application_id"),
    stage,
    type: value(formData, "type"),
    date: value(formData, "date"),
    format,
    interviewer_count: count,
    atmosphere: value(formData, "atmosphere"),
    overall_review: value(formData, "overall_review"),
    result,
  };
}

export async function addInterview(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const parsed = readInterview(formData);
  if (typeof parsed === "string") return { ok: false, message: parsed };

  const { error } = await supabase
    .from("interviews")
    .insert({ user_id: userId, ...parsed });

  if (error) {
    console.error("[interviews] 저장 실패", error.message);
    return { ok: false, message: "저장하지 못했습니다." };
  }

  revalidateAll();
  return { ok: true, message: "면접 회차를 추가했습니다." };
}

export async function updateInterview(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "잘못된 요청입니다." };

  const parsed = readInterview(formData);
  if (typeof parsed === "string") return { ok: false, message: parsed };

  const { error } = await supabase
    .from("interviews")
    .update(parsed)
    .eq("id", id);

  if (error) {
    console.error("[interviews] 수정 실패", error.message);
    return { ok: false, message: "저장하지 못했습니다." };
  }

  revalidateAll(id);
  return { ok: true, message: "수정했습니다." };
}

export async function removeInterview(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await supabase.from("interviews").delete().eq("id", id);
  if (error) console.error("[interviews] 삭제 실패", error.message);

  revalidateAll();
}

/* ---------------- 질문 ---------------- */

/**
 * 빠른 기록용. 질문 한 줄만 받아 바로 넣는다.
 * 면접 직후에는 답변을 정리할 여유가 없으므로 질문만 쏟아 넣게 한다.
 */
export async function addQuestion(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const interviewId = String(formData.get("interview_id") ?? "");
  if (!interviewId) return { ok: false, message: "잘못된 요청입니다." };

  const question = value(formData, "question");
  if (!question) return { ok: false, message: "질문을 입력해 주세요." };

  const parentId = value(formData, "parent_id");

  // 순서는 현재 개수 다음으로 둔다.
  const { count } = await supabase
    .from("interview_questions")
    .select("id", { count: "exact", head: true })
    .eq("interview_id", interviewId);

  const { error } = await supabase.from("interview_questions").insert({
    user_id: userId,
    interview_id: interviewId,
    parent_id: parentId,
    question: question.slice(0, 1000),
    category: value(formData, "category"),
    position: count ?? 0,
  });

  if (error) {
    console.error("[interviews] 질문 저장 실패", error.message);
    return { ok: false, message: "저장하지 못했습니다." };
  }

  revalidateAll(interviewId);
  return { ok: true, message: "추가했습니다." };
}

export async function updateQuestion(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "잘못된 요청입니다." };

  const question = value(formData, "question");
  if (!question) return { ok: false, message: "질문을 입력해 주세요." };

  const category = value(formData, "category");
  if (category && !QUESTION_CATEGORIES.includes(category as never)) {
    return { ok: false, message: "질문 유형이 올바르지 않습니다." };
  }

  const { error } = await supabase
    .from("interview_questions")
    .update({
      question: question.slice(0, 1000),
      my_answer: value(formData, "my_answer"),
      improvement: value(formData, "improvement"),
      category,
    })
    .eq("id", id);

  if (error) {
    console.error("[interviews] 질문 수정 실패", error.message);
    return { ok: false, message: "저장하지 못했습니다." };
  }

  revalidateAll(String(formData.get("interview_id") ?? ""));
  return { ok: true, message: "수정했습니다." };
}

export async function removeQuestion(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await supabase
    .from("interview_questions")
    .delete()
    .eq("id", id);
  if (error) console.error("[interviews] 질문 삭제 실패", error.message);

  revalidateAll(String(formData.get("interview_id") ?? ""));
}
