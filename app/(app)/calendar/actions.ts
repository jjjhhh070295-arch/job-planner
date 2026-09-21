"use server";

import { revalidatePath } from "next/cache";

import { EVENT_KINDS } from "@/lib/calendar";
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

/**
 * 날짜 + (선택) 시각을 서울 기준 시각으로 바꾼다.
 * 시간대를 안 붙이면 UTC 로 해석돼 한국에서 9시간 어긋난다.
 */
function toSeoulIso(date: string, time: string | null): string {
  const hhmm = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return new Date(`${date}T${hhmm}:00+09:00`).toISOString();
}

type Parsed =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; message: string };

function parseEvent(formData: FormData): Parsed {
  const title = value(formData, "title");
  if (!title) return { ok: false, message: "일정 이름을 입력해 주세요." };

  const date = value(formData, "date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, message: "날짜를 골라 주세요." };
  }

  const kind = value(formData, "kind") ?? "개인";
  if (!EVENT_KINDS.includes(kind as never)) {
    return { ok: false, message: "분류가 올바르지 않습니다." };
  }

  const startTime = value(formData, "start_time");
  const endTime = value(formData, "end_time");

  const startAt = toSeoulIso(date, startTime);
  const endAt = endTime ? toSeoulIso(date, endTime) : null;

  if (endAt && endAt < startAt) {
    return { ok: false, message: "종료 시각이 시작보다 빠릅니다." };
  }

  const remindRaw = value(formData, "remind_before_min");
  const remind = remindRaw ? Number.parseInt(remindRaw, 10) : null;
  if (remind !== null && (Number.isNaN(remind) || remind < 0 || remind > 10080)) {
    return { ok: false, message: "알림은 0~10080분 사이로 넣어 주세요." };
  }

  return {
    ok: true,
    row: {
      title,
      kind,
      start_at: startAt,
      end_at: endAt,
      all_day: startTime === null,
      memo: value(formData, "memo"),
      remind_before_min: remind,
    },
  };
}

export async function addEvent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const parsed = parseEvent(formData);
  if (!parsed.ok) return { ok: false, message: parsed.message };

  const { error } = await supabase
    .from("events")
    .insert({ user_id: userId, ...parsed.row });

  if (error) {
    console.error("[calendar] 일정 저장 실패", error.message);
    return { ok: false, message: "저장하지 못했습니다." };
  }

  revalidatePath("/calendar");
  return { ok: true, message: "일정을 추가했습니다." };
}

export async function updateEvent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "잘못된 요청입니다." };

  const parsed = parseEvent(formData);
  if (!parsed.ok) return { ok: false, message: parsed.message };

  const { error } = await supabase
    .from("events")
    .update(parsed.row)
    .eq("id", id);

  if (error) {
    console.error("[calendar] 일정 수정 실패", error.message);
    return { ok: false, message: "저장하지 못했습니다." };
  }

  revalidatePath("/calendar");
  return { ok: true, message: "수정했습니다." };
}

export async function removeEvent(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) console.error("[calendar] 일정 삭제 실패", error.message);

  revalidatePath("/calendar");
}
