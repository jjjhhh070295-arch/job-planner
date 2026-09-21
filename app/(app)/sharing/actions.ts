"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth/current-user";
import { normalizeUsername } from "@/lib/auth/username";
import type { FormState } from "@/lib/form-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SCOPES = ["essays", "interviews", "both"];

export async function createShare(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, message: "로그인이 필요합니다." };

  const username = normalizeUsername(String(formData.get("username") ?? ""));
  if (!username) return { ok: false, message: "상대방 아이디를 입력해 주세요." };
  if (username === profile.username) {
    return { ok: false, message: "자기 자신에게는 공유할 수 없습니다." };
  }

  const scope = String(formData.get("scope") ?? "both");
  if (!SCOPES.includes(scope)) {
    return { ok: false, message: "공유 범위가 올바르지 않습니다." };
  }

  const applicationId = String(formData.get("application_id") ?? "").trim();

  // 다른 사람의 프로필은 RLS 로 막혀 있어서 서버 키로만 찾을 수 있다.
  // 찾은 것은 user_id 하나뿐이고, 그 밖의 정보는 꺼내지 않는다.
  const admin = createAdminClient();
  const { data: target, error: lookupError } = await admin
    .from("profiles")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();

  if (lookupError) {
    console.error("[sharing] 상대 조회 실패", lookupError.message);
    return { ok: false, message: "처리 중 오류가 발생했습니다." };
  }
  if (!target) {
    return { ok: false, message: "그런 아이디를 쓰는 사람이 없습니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("shares").insert({
    owner_id: profile.userId,
    grantee_id: target.user_id,
    application_id: applicationId || null,
    scope,
    memo: String(formData.get("memo") ?? "").trim() || null,
  });

  if (error) {
    console.error("[sharing] 공유 생성 실패", error.message);
    return {
      ok: false,
      message: error.message.includes("shares_unique")
        ? "이미 같은 대상으로 공유하고 있습니다."
        : "공유하지 못했습니다.",
    };
  }

  revalidatePath("/sharing");
  return { ok: true, message: `@${username} 님에게 공유했습니다.` };
}

/** 회수. 준 사람만 지울 수 있다 (RLS). */
export async function revokeShare(formData: FormData): Promise<void> {
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await supabase.from("shares").delete().eq("id", id);
  if (error) console.error("[sharing] 회수 실패", error.message);

  revalidatePath("/sharing");
}
