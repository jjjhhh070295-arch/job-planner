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

/* ============================================================
   이력서 일괄 입력 (CLAUDE.md 7장).
   이력서 원문은 AI API 로 보내지 않는다. 사용자가 자기 AI 채팅에서 받은
   JSON 을 붙여넣으면 여기서 검사해 저장한다.
   ============================================================ */

const DEGREES = ["학사", "전문학사", "석사", "박사", "고졸"];

function asText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  return trimmed.slice(0, max);
}

function asDate(raw: unknown): string | null {
  const text = asText(raw, 10);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export async function importProfileJson(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const raw = String(formData.get("json") ?? "").trim();
  if (!raw) return { ok: false, message: "붙여넣은 내용이 없습니다." };

  // AI 가 앞뒤에 코드블록 표시를 붙여 주는 일이 흔하다.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      ok: false,
      message:
        "JSON 형식이 아닙니다. AI 답변에서 { 로 시작해 } 로 끝나는 부분만 붙여넣어 주세요.",
    };
  }

  const data = parsed as {
    education?: unknown[];
    experiences?: unknown[];
  };

  const educationRows = (Array.isArray(data.education) ? data.education : [])
    .map((item) => {
      const row = item as Record<string, unknown>;
      const school = asText(row.school, 100);
      if (!school) return null;
      const degree = asText(row.degree, 20);
      return {
        user_id: userId,
        school,
        major: asText(row.major, 100),
        degree: degree && DEGREES.includes(degree) ? degree : null,
        start_date: asDate(row.start_date),
        end_date: asDate(row.end_date),
        gpa: asText(row.gpa, 30),
        key_courses: asText(row.key_courses, 500),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .slice(0, 20);

  const experienceRows = (Array.isArray(data.experiences) ? data.experiences : [])
    .map((item) => {
      const row = item as Record<string, unknown>;
      const title = asText(row.title, 100);
      if (!title) return null;
      const tags = Array.isArray(row.tags)
        ? row.tags
            .map((tag) => asText(tag, 30))
            .filter((tag): tag is string => tag !== null)
            .slice(0, 10)
        : [];
      return {
        user_id: userId,
        title,
        org: asText(row.org, 100),
        period_start: asDate(row.period_start),
        period_end: asDate(row.period_end),
        role: asText(row.role, 100),
        situation: asText(row.situation, 2000),
        action: asText(row.action, 2000),
        result: asText(row.result, 2000),
        tags,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .slice(0, 50);

  if (educationRows.length === 0 && experienceRows.length === 0) {
    return {
      ok: false,
      message: "넣을 학력이나 경험을 찾지 못했습니다. JSON 형식을 확인해 주세요.",
    };
  }

  if (educationRows.length > 0) {
    const { error } = await supabase.from("education").insert(educationRows);
    if (error) {
      console.error("[profile] 학력 일괄 입력 실패", error.message);
      return { ok: false, message: "학력을 넣지 못했습니다." };
    }
  }

  if (experienceRows.length > 0) {
    const { error } = await supabase
      .from("experiences")
      .insert(experienceRows);
    if (error) {
      console.error("[profile] 경험 일괄 입력 실패", error.message);
      return {
        ok: false,
        message: "경험을 넣지 못했습니다. 학력은 저장됐을 수 있습니다.",
      };
    }
  }

  revalidatePath("/profile");
  return {
    ok: true,
    message: `학력 ${educationRows.length}건, 경험 ${experienceRows.length}건을 넣었습니다. 내용을 확인하고 고쳐 주세요.`,
  };
}
