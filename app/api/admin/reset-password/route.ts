import { randomInt } from "node:crypto";

import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth/current-user";
import { normalizeUsername } from "@/lib/auth/username";
import { createAdminClient, isAdminUsername } from "@/lib/supabase/admin";

// 헷갈리기 쉬운 글자(0 O o, 1 l I)를 뺀 문자 집합.
// 임시 비밀번호는 운영자가 읽어서 전달하는 값이라 오해 없는 게 중요하다.
const ALPHABET = "abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
const TEMP_PASSWORD_LENGTH = 12;

function generateTempPassword(): string {
  let result = "";
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i += 1) {
    result += ALPHABET[randomInt(ALPHABET.length)];
  }
  return result;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: Request) {
  const actor = await getCurrentProfile();
  if (!actor) {
    return bad("로그인이 필요합니다.", 401);
  }
  if (!isAdminUsername(actor.username)) {
    // 관리자가 아니면 이 기능이 있다는 것조차 알리지 않는다.
    return bad("권한이 없습니다.", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("요청 형식이 올바르지 않습니다.");
  }

  const username = normalizeUsername(String(body.username ?? ""));
  if (!username) {
    return bad("대상 아이디가 없습니다.");
  }

  const admin = createAdminClient();

  const { data: target, error: lookupError } = await admin
    .from("profiles")
    .select("user_id, username, display_name")
    .eq("username", username)
    .maybeSingle();

  if (lookupError) {
    console.error("[reset-password] 대상 조회 실패", lookupError.message);
    return bad("처리 중 오류가 발생했습니다.", 500);
  }
  if (!target) {
    return bad("그런 아이디가 없습니다.");
  }

  const tempPassword = generateTempPassword();

  const { error: updateError } = await admin.auth.admin.updateUserById(
    target.user_id,
    { password: tempPassword },
  );
  if (updateError) {
    console.error("[reset-password] 비밀번호 설정 실패", updateError.message);
    return bad("임시 비밀번호를 설정하지 못했습니다.", 500);
  }

  // 본인이 새 비밀번호로 바꿀 때까지 다른 화면을 막는다.
  const { error: flagError } = await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("user_id", target.user_id);

  if (flagError) {
    console.error("[reset-password] 플래그 설정 실패", flagError.message);
  }

  // 임시 비밀번호는 이 응답에서 딱 한 번만 돌려준다. 어디에도 저장하지 않는다.
  return NextResponse.json({
    ok: true,
    username: target.username,
    displayName: target.display_name,
    tempPassword,
  });
}
