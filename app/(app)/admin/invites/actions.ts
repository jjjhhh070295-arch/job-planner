"use server";

import { randomInt } from "node:crypto";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/lib/auth/current-user";
import type { FormState } from "@/lib/form-state";
import { createAdminClient, isAdminUsername } from "@/lib/supabase/admin";

/** 초대 코드에 쓰는 글자. 헷갈리는 0 O 1 I 는 뺐다. 운영자가 읽어서 전달하기 때문. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(length = 8): string {
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += ALPHABET[randomInt(ALPHABET.length)];
  }
  return result;
}

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

export async function createInviteCode(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const usesRaw = value(formData, "max_uses");
  const maxUses = usesRaw ? Number.parseInt(usesRaw, 10) : 1;
  if (Number.isNaN(maxUses) || maxUses < 1 || maxUses > 100) {
    return { ok: false, message: "사용 횟수는 1~100 사이로 넣어 주세요." };
  }

  const daysRaw = value(formData, "valid_days");
  const days = daysRaw ? Number.parseInt(daysRaw, 10) : null;
  if (days !== null && (Number.isNaN(days) || days < 1 || days > 365)) {
    return { ok: false, message: "유효기간은 1~365일 사이로 넣어 주세요." };
  }

  const expiresAt =
    days === null
      ? null
      : new Date(Date.now() + days * 86_400_000).toISOString();

  // 아주 드물게 같은 코드가 나올 수 있으므로 몇 번 다시 뽑는다.
  let lastError = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode();
    const { error } = await admin.from("invite_codes").insert({
      code,
      max_uses: maxUses,
      expires_at: expiresAt,
      memo: value(formData, "memo"),
    });

    if (!error) {
      revalidatePath("/admin/invites");
      return { ok: true, message: `초대 코드 ${code} 를 만들었습니다.` };
    }
    lastError = error.message;
    if (!error.message.includes("duplicate")) break;
  }

  console.error("[admin] 초대 코드 생성 실패", lastError);
  return { ok: false, message: "초대 코드를 만들지 못했습니다." };
}

/** 코드를 지우지 않고 더 못 쓰게 막는다. 기록은 남겨 두는 편이 낫다. */
export async function disableInviteCode(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await admin
    .from("invite_codes")
    .update({ expires_at: new Date().toISOString() })
    .eq("id", id);

  if (error) console.error("[admin] 코드 막기 실패", error.message);

  revalidatePath("/admin/invites");
}

/** 막아 둔 코드를 다시 쓸 수 있게 한다 (30일 연장). */
export async function extendInviteCode(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("잘못된 요청입니다.");

  const { error } = await admin
    .from("invite_codes")
    .update({ expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString() })
    .eq("id", id);

  if (error) console.error("[admin] 코드 연장 실패", error.message);

  revalidatePath("/admin/invites");
}
