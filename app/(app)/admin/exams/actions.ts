"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth/current-user";
import type { FormState } from "@/lib/form-state";
import { createAdminClient, isAdminUsername } from "@/lib/supabase/admin";

const CATEGORIES = ["자격증", "어학", "기타"];

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || !isAdminUsername(profile.username)) {
    throw new Error("권한이 없습니다.");
  }
  return createAdminClient();
}

function value(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

function readExam(formData: FormData): Record<string, unknown> | string {
  const name = value(formData, "name");
  if (!name) return "시험 이름을 입력해 주세요.";

  const category = value(formData, "category") ?? "자격증";
  if (!CATEGORIES.includes(category)) return "분류가 올바르지 않습니다.";

  const regStart = value(formData, "reg_start");
  const regEnd = value(formData, "reg_end");
  if (regStart && regEnd && regEnd < regStart) {
    return "접수 마감이 시작보다 빠릅니다.";
  }

  return {
    name,
    category,
    round: value(formData, "round"),
    reg_start: regStart,
    reg_end: regEnd,
    exam_date: value(formData, "exam_date"),
    result_date: value(formData, "result_date"),
    memo: value(formData, "memo"),
  };
}

export async function addExam(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = readExam(formData);
  if (typeof parsed === "string") return { ok: false, message: parsed };

  const { error } = await admin.from("exams").insert(parsed);
  if (error) {
    console.error("[admin] 시험 일정 저장 실패", error.message);
    return {
      ok: false,
      message: error.message.includes("duplicate")
        ? "같은 이름과 회차가 이미 있습니다."
        : "저장하지 못했습니다.",
    };
  }

  revalidatePath("/admin/exams");
  revalidatePath("/calendar");
  return { ok: true, message: "시험 일정을 추가했습니다." };
}

export async function updateExam(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "잘못된 요청입니다." };

  const parsed = readExam(formData);
  if (typeof parsed === "string") return { ok: false, message: parsed };

  const { error } = await admin.from("exams").update(parsed).eq("id", id);
  if (error) {
    console.error("[admin] 시험 일정 수정 실패", error.message);
    return { ok: false, message: "저장하지 못했습니다." };
  }

  revalidatePath("/admin/exams");
  revalidatePath("/calendar");
  return { ok: true, message: "수정했습니다." };
}

export async function removeExam(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await admin.from("exams").delete().eq("id", id);
  if (error) console.error("[admin] 시험 일정 삭제 실패", error.message);

  revalidatePath("/admin/exams");
  revalidatePath("/calendar");
}
