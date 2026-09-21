"use server";

import { revalidatePath } from "next/cache";

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

function revalidateAll() {
  revalidatePath("/study");
  revalidatePath("/roadmap");
  revalidatePath("/");
}

/**
 * 타이머 시작.
 * 시작 시각만 남기고 끝나는 시각은 비워 둔다. 브라우저가 꺼져도 기록이 이어진다.
 */
export async function startTimer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const subject = value(formData, "subject");
  if (!subject) return { ok: false, message: "과목을 입력해 주세요." };

  const { error } = await supabase.from("study_sessions").insert({
    user_id: userId,
    subject,
    started_at: new Date().toISOString(),
    source: "timer",
    milestone_id: value(formData, "milestone_id"),
  });

  if (error) {
    console.error("[study] 타이머 시작 실패", error.message);
    // 부분 유니크 인덱스에 걸리면 이미 돌고 있는 타이머가 있다는 뜻이다.
    return {
      ok: false,
      message: error.message.includes("study_sessions_one_running")
        ? "이미 돌고 있는 타이머가 있습니다. 먼저 끝내 주세요."
        : "타이머를 시작하지 못했습니다.",
    };
  }

  revalidateAll();
  return { ok: true, message: "타이머를 시작했습니다." };
}

export async function stopTimer(formData: FormData): Promise<void> {
  const { supabase, userId } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await supabase
    .from("study_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("ended_at", null);

  if (error) console.error("[study] 타이머 종료 실패", error.message);

  revalidateAll();
}

/** 돌고 있던 타이머를 기록으로 남기지 않고 버린다. */
export async function cancelTimer(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await supabase
    .from("study_sessions")
    .delete()
    .eq("id", id)
    .is("ended_at", null);

  if (error) console.error("[study] 타이머 취소 실패", error.message);

  revalidateAll();
}

/** 날짜 + 시작 시각 + 공부한 분 을 받아 한 건으로 만든다. */
export async function addManualSession(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const subject = value(formData, "subject");
  if (!subject) return { ok: false, message: "과목을 입력해 주세요." };

  const date = value(formData, "date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, message: "날짜를 골라 주세요." };
  }

  const minutesRaw = value(formData, "minutes");
  const minutes = minutesRaw ? Number.parseInt(minutesRaw, 10) : NaN;
  if (Number.isNaN(minutes) || minutes < 1 || minutes > 1440) {
    return { ok: false, message: "공부 시간은 1~1440분 사이로 넣어 주세요." };
  }

  const timeText = value(formData, "start_time");
  const hhmm = timeText && /^\d{2}:\d{2}$/.test(timeText) ? timeText : "00:00";

  // 시간대를 안 붙이면 UTC 로 읽혀 한국 기준과 9시간 어긋난다.
  const startedAt = new Date(`${date}T${hhmm}:00+09:00`);
  const endedAt = new Date(startedAt.getTime() + minutes * 60_000);

  const { error } = await supabase.from("study_sessions").insert({
    user_id: userId,
    subject,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    source: "manual",
    milestone_id: value(formData, "milestone_id"),
    memo: value(formData, "memo"),
  });

  if (error) {
    console.error("[study] 수동 입력 실패", error.message);
    return { ok: false, message: "저장하지 못했습니다." };
  }

  revalidateAll();
  return { ok: true, message: `${minutes}분을 기록했습니다.` };
}

export async function removeSession(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await supabase
    .from("study_sessions")
    .delete()
    .eq("id", id);
  if (error) console.error("[study] 삭제 실패", error.message);

  revalidateAll();
}

/** 캡처에서 읽은 값을 사람이 확인·수정한 뒤 저장한다. */
export async function saveCaptureSession(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const subject = value(formData, "subject");
  if (!subject) return { ok: false, message: "과목을 입력해 주세요." };

  const date = value(formData, "date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, message: "날짜를 골라 주세요." };
  }

  const minutesRaw = value(formData, "minutes");
  const minutes = minutesRaw ? Number.parseInt(minutesRaw, 10) : NaN;
  if (Number.isNaN(minutes) || minutes < 1 || minutes > 1440) {
    return { ok: false, message: "공부 시간은 1~1440분 사이로 넣어 주세요." };
  }

  const capturePath = value(formData, "capture_path");
  // 남의 폴더 경로를 밀어 넣지 못하게 막는다.
  if (capturePath && !capturePath.startsWith(`${userId}/`)) {
    return { ok: false, message: "잘못된 파일 경로입니다." };
  }

  const startedAt = new Date(`${date}T00:00:00+09:00`);
  const endedAt = new Date(startedAt.getTime() + minutes * 60_000);

  const { error } = await supabase.from("study_sessions").insert({
    user_id: userId,
    subject,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    source: "capture",
    capture_path: capturePath,
    milestone_id: value(formData, "milestone_id"),
  });

  if (error) {
    console.error("[study] 캡처 기록 저장 실패", error.message);
    return { ok: false, message: "저장하지 못했습니다." };
  }

  revalidateAll();
  return { ok: true, message: `${minutes}분을 기록했습니다.` };
}
