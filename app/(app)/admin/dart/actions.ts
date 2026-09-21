"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth/current-user";
import { DartError, fetchListedCorps } from "@/lib/dart";
import type { FormState } from "@/lib/form-state";
import { createAdminClient, isAdminUsername } from "@/lib/supabase/admin";

export async function syncDartCorps(
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile || !isAdminUsername(profile.username)) {
    return { ok: false, message: "권한이 없습니다." };
  }

  try {
    const corps = await fetchListedCorps();
    if (corps.length === 0) {
      return { ok: false, message: "받은 목록이 비어 있습니다." };
    }

    const admin = createAdminClient();

    // 한 번에 다 넣으면 요청이 너무 커진다. 나눠서 넣는다.
    const size = 500;
    for (let i = 0; i < corps.length; i += size) {
      const chunk = corps.slice(i, i + size).map((corp) => ({
        ...corp,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await admin
        .from("dart_corps")
        .upsert(chunk, { onConflict: "corp_code" });
      if (error) {
        console.error("[dart] 저장 실패", error.message);
        return { ok: false, message: "저장 중 오류가 났습니다." };
      }
    }

    revalidatePath("/admin/dart");
    return {
      ok: true,
      message: `상장사 ${corps.length.toLocaleString()}개를 받았습니다.`,
    };
  } catch (error) {
    if (error instanceof DartError) {
      return { ok: false, message: error.message };
    }
    console.error("[dart] 목록 가져오기 실패", error);
    return { ok: false, message: "목록을 가져오지 못했습니다." };
  }
}
