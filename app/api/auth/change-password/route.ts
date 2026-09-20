import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getCurrentProfile } from "@/lib/auth/current-user";
import { isValidPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { usernameToEmail } from "@/lib/auth/username";
import { createAdminClient } from "@/lib/supabase/admin";

function bad(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return bad("로그인이 필요합니다.", 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("요청 형식이 올바르지 않습니다.");
  }

  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");

  if (!currentPassword) {
    return bad("기존 비밀번호를 입력해 주세요.");
  }
  if (!isValidPassword(newPassword)) {
    return bad(`새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
  }
  if (currentPassword === newPassword) {
    return bad("새 비밀번호가 기존 비밀번호와 같습니다.");
  }

  // 기존 비밀번호 확인.
  // 쿠키를 건드리지 않는 임시 클라이언트로 로그인을 시도해 본다.
  // 성공하면 비밀번호가 맞는 것이고, 현재 로그인 세션에는 영향이 없다.
  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: usernameToEmail(profile.username),
    password: currentPassword,
  });

  if (verifyError) {
    return bad("기존 비밀번호가 올바르지 않습니다.");
  }
  await verifier.auth.signOut();

  const admin = createAdminClient();

  const { error: updateError } = await admin.auth.admin.updateUserById(
    profile.userId,
    { password: newPassword },
  );
  if (updateError) {
    console.error("[change-password] 비밀번호 변경 실패", updateError.message);
    return bad("비밀번호를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
  }

  // 임시 비밀번호로 들어온 경우였다면 그 표시를 지운다.
  const { error: flagError } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("user_id", profile.userId);

  if (flagError) {
    console.error("[change-password] 플래그 해제 실패", flagError.message);
  }

  return NextResponse.json({ ok: true });
}
