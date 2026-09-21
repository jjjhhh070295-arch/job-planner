"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { STATUSES, type Status } from "@/lib/application-status";
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

type EssayInput = { question: string; char_limit: number | null };

/**
 * 파싱 결과를 사람이 확인·수정한 뒤 저장한다.
 * AI 가 뽑은 값을 그대로 저장하지 않고 반드시 이 단계를 거친다 (CLAUDE.md 7장).
 */
export async function saveParsedPosting(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const company = value(formData, "company");
  if (!company) return { ok: false, message: "기업 이름을 입력해 주세요." };

  const status = value(formData, "status") ?? "작성 중";
  if (!STATUSES.includes(status as Status)) {
    return { ok: false, message: "전형 단계가 올바르지 않습니다." };
  }

  // 날짜만 고른 마감은 그날 끝(서울 23:59)으로 저장한다.
  const deadlineRaw = value(formData, "deadline");
  const deadline =
    deadlineRaw && /^\d{4}-\d{2}-\d{2}$/.test(deadlineRaw)
      ? new Date(`${deadlineRaw}T23:59:00+09:00`).toISOString()
      : null;

  let essays: EssayInput[] = [];
  try {
    const raw = JSON.parse(String(formData.get("essays_json") ?? "[]"));
    if (Array.isArray(raw)) {
      essays = raw
        .map((item) => ({
          question: String(item?.question ?? "").trim(),
          char_limit:
            typeof item?.char_limit === "number" && item.char_limit > 0
              ? Math.floor(item.char_limit)
              : null,
        }))
        .filter((item) => item.question.length > 0)
        .slice(0, 30);
    }
  } catch {
    essays = [];
  }

  let requirements: unknown = null;
  try {
    const raw = String(formData.get("requirements_json") ?? "");
    requirements = raw ? JSON.parse(raw) : null;
  } catch {
    requirements = null;
  }

  const { data: created, error } = await supabase
    .from("applications")
    .insert({
      user_id: userId,
      company,
      role: value(formData, "role"),
      season: value(formData, "season"),
      status,
      deadline,
      posting_url: value(formData, "posting_url"),
      posting_text: value(formData, "posting_text"),
      requirements,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[parse] 지원 저장 실패", error?.message);
    return { ok: false, message: "저장하지 못했습니다. 입력값을 확인해 주세요." };
  }

  if (essays.length > 0) {
    const { error: essayError } = await supabase.from("essays").insert(
      essays.map((item) => ({
        user_id: userId,
        application_id: created.id,
        question: item.question.slice(0, 500),
        char_limit: item.char_limit,
      })),
    );
    if (essayError) {
      // 지원은 이미 저장됐으므로 통째로 실패시키지 않고 알려만 준다.
      console.error("[parse] 자소서 문항 저장 실패", essayError.message);
      return {
        ok: false,
        message:
          "지원은 저장됐지만 자소서 문항을 넣지 못했습니다. 라이브러리에서 직접 추가해 주세요.",
      };
    }
  }

  revalidatePath("/applications");
  revalidatePath("/library");
  revalidatePath("/");
  redirect("/applications");
}
