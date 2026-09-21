"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth/current-user";
import { isValidDisplayName } from "@/lib/auth/username";
import type { FormState } from "@/lib/form-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function updateDisplayName(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, message: "로그인이 필요합니다." };

  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!isValidDisplayName(displayName)) {
    return { ok: false, message: "표시 이름은 1~20자로 입력해 주세요." };
  }

  const supabase = await createClient();
  // display_name 은 본인이 고칠 수 있도록 컬럼 단위 권한이 열려 있다.
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("user_id", profile.userId);

  if (error) {
    console.error("[settings] 표시 이름 변경 실패", error.message);
    return { ok: false, message: "바꾸지 못했습니다." };
  }

  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true, message: "표시 이름을 바꿨습니다." };
}

export async function sendFeedback(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, message: "로그인이 필요합니다." };

  const message = String(formData.get("message") ?? "").trim();
  if (message.length < 5) {
    return { ok: false, message: "5자 이상 적어 주세요." };
  }
  if (message.length > 2000) {
    return { ok: false, message: "2000자 이내로 적어 주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("feedback").insert({
    user_id: profile.userId,
    message,
    page_path: String(formData.get("page_path") ?? "") || null,
  });

  if (error) {
    console.error("[settings] 피드백 저장 실패", error.message);
    return { ok: false, message: "보내지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  return { ok: true, message: "보냈습니다. 읽고 반영하겠습니다." };
}

/**
 * 회원 탈퇴.
 * auth.users 한 행을 지우면 프로필·지원·자소서·목표·할 일·일정이
 * on delete cascade 로 전부 사라진다.
 */
export async function deleteAccount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, message: "로그인이 필요합니다." };

  // 실수로 누르는 것을 막기 위해 아이디를 그대로 치게 한다.
  const typed = String(formData.get("confirm_username") ?? "").trim();
  if (typed !== profile.username) {
    return {
      ok: false,
      message: `확인을 위해 아이디 "${profile.username}" 을(를) 정확히 입력해 주세요.`,
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(profile.userId);

  if (error) {
    console.error("[settings] 탈퇴 실패", error.message);
    return { ok: false, message: "탈퇴 처리에 실패했습니다. 운영자에게 알려 주세요." };
  }

  return { ok: true, message: "탈퇴했습니다." };
}
