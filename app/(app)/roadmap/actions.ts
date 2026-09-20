"use server";

import { revalidatePath } from "next/cache";

import { AUTO_SOURCES, type AutoSource } from "@/lib/roadmap";
import { mondayOf, todayInSeoul } from "@/lib/date";
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

function revalidateAll() {
  revalidatePath("/roadmap");
  revalidatePath("/");
}

// ---------------- 목표 ----------------

export async function addGoal(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const title = value(formData, "title");
  if (!title) return { ok: false, message: "목표를 입력해 주세요." };

  const { error } = await supabase.from("goals").insert({
    user_id: userId,
    title,
    due_date: value(formData, "due_date"),
  });

  if (error) {
    console.error("[roadmap] 목표 저장 실패", error.message);
    return { ok: false, message: "저장하지 못했습니다." };
  }

  revalidateAll();
  return { ok: true, message: "목표를 추가했습니다." };
}

export async function removeGoal(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  // 목표를 지우면 그 아래 마일스톤도 함께 지워진다 (on delete cascade).
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) console.error("[roadmap] 목표 삭제 실패", error.message);

  revalidateAll();
}

// ---------------- 마일스톤 ----------------

export async function addMilestone(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const title = value(formData, "title");
  if (!title) return { ok: false, message: "마일스톤 이름을 입력해 주세요." };

  const source = (value(formData, "auto_source") ?? "manual") as AutoSource;
  if (!AUTO_SOURCES.some((item) => item.value === source)) {
    return { ok: false, message: "진행률 기준이 올바르지 않습니다." };
  }

  const targetRaw = value(formData, "target_value");
  const target = targetRaw ? Number.parseInt(targetRaw, 10) : 1;
  if (Number.isNaN(target) || target < 1) {
    return { ok: false, message: "목표 수치는 1 이상의 숫자여야 합니다." };
  }

  const { error } = await supabase.from("milestones").insert({
    user_id: userId,
    goal_id: value(formData, "goal_id"),
    title,
    month: value(formData, "month"),
    target_value: target,
    auto_source: source,
  });

  if (error) {
    console.error("[roadmap] 마일스톤 저장 실패", error.message);
    return { ok: false, message: "저장하지 못했습니다. 입력값을 확인해 주세요." };
  }

  revalidateAll();
  return { ok: true, message: "마일스톤을 추가했습니다." };
}

/** 직접 세는 마일스톤의 숫자를 1 올리거나 내린다. */
export async function bumpMilestone(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  const delta = Number.parseInt(String(formData.get("delta") ?? "0"), 10);
  if (!id || ![1, -1].includes(delta)) throw new Error("잘못된 요청입니다.");

  const { data: current } = await supabase
    .from("milestones")
    .select("manual_value")
    .eq("id", id)
    .single();

  if (!current) return;

  const next = Math.max(0, (current.manual_value as number) + delta);
  const { error } = await supabase
    .from("milestones")
    .update({ manual_value: next })
    .eq("id", id);

  if (error) console.error("[roadmap] 진행률 변경 실패", error.message);

  revalidateAll();
}

export async function removeMilestone(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await supabase.from("milestones").delete().eq("id", id);
  if (error) console.error("[roadmap] 마일스톤 삭제 실패", error.message);

  revalidateAll();
}

// ---------------- 할 일 ----------------

export async function addTask(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, userId } = await requireUser();

  const title = value(formData, "title");
  if (!title) return { ok: false, message: "할 일을 입력해 주세요." };

  const dueDate = value(formData, "due_date");
  const isToday = value(formData, "when") === "오늘";

  const { error } = await supabase.from("tasks").insert({
    user_id: userId,
    milestone_id: value(formData, "milestone_id"),
    title,
    due_date: dueDate,
    // 주간 묶음은 마감일 기준, 없으면 이번 주로 넣는다.
    week_of: mondayOf(dueDate ?? todayInSeoul()),
    is_today: isToday,
  });

  if (error) {
    console.error("[roadmap] 할 일 저장 실패", error.message);
    return { ok: false, message: "저장하지 못했습니다." };
  }

  revalidateAll();
  return { ok: true, message: "할 일을 추가했습니다." };
}

export async function toggleTask(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "") === "true";
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await supabase
    .from("tasks")
    .update({ done: next, done_at: next ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) console.error("[roadmap] 할 일 상태 변경 실패", error.message);

  revalidateAll();
}

/** 오늘 할 일로 올리거나 내린다. */
export async function toggleTaskToday(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "") === "true";
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await supabase
    .from("tasks")
    .update({ is_today: next })
    .eq("id", id);

  if (error) console.error("[roadmap] 오늘 할 일 변경 실패", error.message);

  revalidateAll();
}

export async function removeTask(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) console.error("[roadmap] 할 일 삭제 실패", error.message);

  revalidateAll();
}
