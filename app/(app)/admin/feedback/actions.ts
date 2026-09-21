"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth/current-user";
import { createAdminClient, isAdminUsername } from "@/lib/supabase/admin";

/** 읽고 처리한 의견에 표시를 남긴다. 지우지는 않는다. */
export async function toggleFeedbackHandled(formData: FormData): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile || !isAdminUsername(profile.username)) {
    throw new Error("권한이 없습니다.");
  }

  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "") === "true";
  if (!id) throw new Error("잘못된 요청입니다.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("feedback")
    .update({ handled: next })
    .eq("id", id);

  if (error) console.error("[admin] 의견 상태 변경 실패", error.message);

  revalidatePath("/admin/feedback");
}
