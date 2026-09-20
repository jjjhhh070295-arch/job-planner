"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { STATUSES, type Status } from "@/lib/application-status";
import type { FormState } from "@/lib/form-state";

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

export async function addApplication(
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

  // 날짜 칸은 "2026-10-15" 만 온다. 시간대를 안 붙이면 UTC 자정으로 해석돼
  // 한국에서는 오전 9시가 된다. 마감일은 그날 끝까지이므로 서울 23:59 로 맞춘다.
  const deadlineRaw = value(formData, "deadline");
  const deadline =
    deadlineRaw && /^\d{4}-\d{2}-\d{2}$/.test(deadlineRaw)
      ? new Date(`${deadlineRaw}T23:59:00+09:00`).toISOString()
      : null;

  const { error } = await supabase.from("applications").insert({
    user_id: userId,
    company,
    role: value(formData, "role"),
    season: value(formData, "season"),
    status,
    deadline,
    posting_url: value(formData, "posting_url"),
    memo: value(formData, "memo"),
  });

  if (error) {
    console.error("[applications] 추가 실패", error.message);
    return { ok: false, message: "저장하지 못했습니다. 입력값을 확인해 주세요." };
  }

  revalidatePath("/applications");
  return { ok: true, message: "추가했습니다." };
}

/** 칸반에서 카드의 단계를 바꾼다. 드래그 대신 드롭다운을 쓴다. */
export async function updateApplicationStatus(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !STATUSES.includes(status as Status)) {
    throw new Error("잘못된 요청입니다.");
  }

  const { error } = await supabase
    .from("applications")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("[applications] 단계 변경 실패", error.message);
  }

  revalidatePath("/applications");
}

export async function removeApplication(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  // RLS 가 본인 행만 지우도록 막아 준다.
  const { error } = await supabase.from("applications").delete().eq("id", id);
  if (error) {
    console.error("[applications] 삭제 실패", error.message);
  }

  revalidatePath("/applications");
}
