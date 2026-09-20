import { NextResponse } from "next/server";

import {
  clientIp,
  isRateLimited,
  rateLimitMessage,
  recordAttempt,
} from "@/lib/auth/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isValidDisplayName,
  isValidUsername,
  normalizeInviteCode,
  normalizeUsername,
  usernameToEmail,
} from "@/lib/auth/username";

/** 화면에 그대로 보여줄 안내 문구와 함께 400 응답 */
function bad(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("요청 형식이 올바르지 않습니다.");
  }

  const username = normalizeUsername(String(body.username ?? ""));
  const displayName = String(body.displayName ?? "").trim();
  const password = String(body.password ?? "");
  const inviteCode = normalizeInviteCode(String(body.inviteCode ?? ""));

  // 초대 코드를 기계로 훑는 것을 막는다. IP 기준으로만 센다.
  const ip = `ip:${clientIp(request)}`;
  if (await isRateLimited("invite", [ip])) {
    return NextResponse.json(
      { message: rateLimitMessage("invite") },
      { status: 429 },
    );
  }

  if (!isValidUsername(username)) {
    return bad("아이디는 영문 소문자로 시작하는 영문·숫자·밑줄 3~20자여야 합니다.");
  }
  if (!isValidDisplayName(displayName)) {
    return bad("표시 이름은 1~20자로 입력해 주세요.");
  }
  if (password.length < 8) {
    return bad("비밀번호는 8자 이상이어야 합니다.");
  }
  if (!inviteCode) {
    return bad("초대 코드를 입력해 주세요.");
  }

  const admin = createAdminClient();

  // 1) 아이디 중복을 먼저 본다. 초대 코드를 괜히 소모하지 않기 위해 순서가 중요하다.
  const { data: existing, error: lookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (lookupError) {
    console.error("[signup] 아이디 조회 실패", lookupError);
    return NextResponse.json({ message: "가입 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
  if (existing) {
    return bad("이미 사용 중인 아이디입니다.");
  }

  // 2) 초대 코드 소비. DB 함수가 UPDATE 한 번으로 처리하므로 동시 가입에도 한도를 넘지 않는다.
  const { data: consumed, error: consumeError } = await admin.rpc(
    "consume_invite_code",
    { p_code: inviteCode },
  );

  if (consumeError) {
    console.error("[signup] 초대 코드 처리 실패", consumeError);
    return NextResponse.json({ message: "가입 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
  if (consumed !== true) {
    await recordAttempt("invite", ip, false);
    return bad("초대 코드가 올바르지 않거나, 사용 가능 횟수가 모두 소진되었습니다.");
  }

  // 3) 계정 생성. 여기서부터 실패하면 소비한 코드를 되돌려 놓는다.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true, // 인증 메일을 쓰지 않으므로 바로 확인된 상태로 만든다
    user_metadata: { username, display_name: displayName },
  });

  if (createError || !created?.user) {
    await admin.rpc("release_invite_code", { p_code: inviteCode });
    console.error("[signup] 계정 생성 실패", createError);
    const alreadyExists = createError?.message?.includes("already");
    return bad(
      alreadyExists
        ? "이미 사용 중인 아이디입니다."
        : "계정을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  // 4) 프로필 생성. 실패하면 방금 만든 계정까지 되돌린다.
  const { error: profileError } = await admin.from("profiles").insert({
    user_id: created.user.id,
    username,
    display_name: displayName,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.rpc("release_invite_code", { p_code: inviteCode });
    console.error("[signup] 프로필 생성 실패", profileError);
    return NextResponse.json({ message: "가입 처리 중 오류가 발생했습니다." }, { status: 500 });
  }

  await recordAttempt("invite", ip, true);
  return NextResponse.json({ ok: true });
}
