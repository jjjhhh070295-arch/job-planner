"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import type { FormState } from "@/lib/form-state";

/**
 * Server Action 은 인증된 화면에서만 호출된다고 가정하면 안 된다.
 * (Next.js 문서 경고) 그래서 액션마다 직접 로그인 여부를 확인한다.
 */
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

/** 빈 문자열은 null 로 바꾼다. 날짜 칸을 비워 두면 빈 문자열이 오기 때문. */
function value(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

function tagList(formData: FormData, key: string): string[] {
  const raw = value(formData, key);
  if (!raw) return [];
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function failure(error: { message: string }): FormState {
  console.error("[profile] 저장 실패", error.message);
  return { ok: false, message: "저장하지 못했습니다. 입력값을 확인해 주세요." };
}

export async function addEducation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const school = value(formData, "school");
  if (!school) return { ok: false, message: "학교 이름을 입력해 주세요." };

  const { error } = await supabase.from("education").insert({
    user_id: userId,
    school,
    major: value(formData, "major"),
    degree: value(formData, "degree"),
    start_date: value(formData, "start_date"),
    end_date: value(formData, "end_date"),
    gpa: value(formData, "gpa"),
    key_courses: value(formData, "key_courses"),
  });

  if (error) return failure(error);

  revalidatePath("/profile");
  return { ok: true, message: "추가했습니다." };
}

export async function addSpec(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const name = value(formData, "name");
  if (!name) return { ok: false, message: "이름을 입력해 주세요." };

  const { error } = await supabase.from("user_specs").insert({
    user_id: userId,
    name,
    category: value(formData, "category") ?? "자격증",
    status: value(formData, "status") ?? "보유",
    score_or_grade: value(formData, "score_or_grade"),
    acquired_date: value(formData, "acquired_date"),
    expiry_date: value(formData, "expiry_date"),
    target_exam_id: value(formData, "target_exam_id"),
  });

  if (error) return failure(error);

  revalidatePath("/profile");
  return { ok: true, message: "추가했습니다." };
}

export async function addExperience(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const title = value(formData, "title");
  if (!title) return { ok: false, message: "제목을 입력해 주세요." };

  const { error } = await supabase.from("experiences").insert({
    user_id: userId,
    title,
    org: value(formData, "org"),
    period_start: value(formData, "period_start"),
    period_end: value(formData, "period_end"),
    role: value(formData, "role"),
    situation: value(formData, "situation"),
    action: value(formData, "action"),
    result: value(formData, "result"),
    tags: tagList(formData, "tags"),
  });

  if (error) return failure(error);

  revalidatePath("/profile");
  return { ok: true, message: "추가했습니다." };
}

// 폼에서 넘어온 테이블 이름을 그대로 믿으면 안 되므로 허용 목록으로 제한한다.
const DELETABLE = ["education", "user_specs", "experiences"] as const;
type DeletableTable = (typeof DELETABLE)[number];

export async function removeProfileRow(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const table = String(formData.get("table") ?? "");
  const id = String(formData.get("id") ?? "");

  if (!DELETABLE.includes(table as DeletableTable) || !id) {
    throw new Error("잘못된 요청입니다.");
  }

  // RLS 가 본인 행만 지우도록 막아 주지만, 한 번 더 조건을 건다.
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) {
    console.error("[profile] 삭제 실패", error.message);
  }

  revalidatePath("/profile");
}

// ---------------- 수정 ----------------

export async function updateEducation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "잘못된 요청입니다." };

  const school = value(formData, "school");
  if (!school) return { ok: false, message: "학교 이름을 입력해 주세요." };

  // RLS 가 본인 행만 고치도록 막아 준다.
  const { error } = await supabase
    .from("education")
    .update({
      school,
      major: value(formData, "major"),
      degree: value(formData, "degree"),
      start_date: value(formData, "start_date"),
      end_date: value(formData, "end_date"),
      gpa: value(formData, "gpa"),
      key_courses: value(formData, "key_courses"),
    })
    .eq("id", id);

  if (error) return failure(error);

  revalidatePath("/profile");
  return { ok: true, message: "수정했습니다." };
}

export async function updateSpec(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "잘못된 요청입니다." };

  const name = value(formData, "name");
  if (!name) return { ok: false, message: "이름을 입력해 주세요." };

  const { error } = await supabase
    .from("user_specs")
    .update({
      name,
      category: value(formData, "category") ?? "자격증",
      status: value(formData, "status") ?? "보유",
      score_or_grade: value(formData, "score_or_grade"),
      acquired_date: value(formData, "acquired_date"),
      expiry_date: value(formData, "expiry_date"),
      target_exam_id: value(formData, "target_exam_id"),
    })
    .eq("id", id);

  if (error) return failure(error);

  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath("/calendar");
  return { ok: true, message: "수정했습니다." };
}

export async function updateExperience(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "잘못된 요청입니다." };

  const title = value(formData, "title");
  if (!title) return { ok: false, message: "제목을 입력해 주세요." };

  const { error } = await supabase
    .from("experiences")
    .update({
      title,
      org: value(formData, "org"),
      period_start: value(formData, "period_start"),
      period_end: value(formData, "period_end"),
      role: value(formData, "role"),
      situation: value(formData, "situation"),
      action: value(formData, "action"),
      result: value(formData, "result"),
      tags: tagList(formData, "tags"),
    })
    .eq("id", id);

  if (error) return failure(error);

  revalidatePath("/profile");
  return { ok: true, message: "수정했습니다." };
}
